import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { TOOL_LABELS, type ToolId } from "@/lib/permissions";

export const runtime = "nodejs";

type HelpRequestBody = {
  messages?: { role: "user" | "assistant"; content: string }[];
};

// "none" rather than null: the API rejects an enum whose values don't all
// match a union `type: ["string","null"]` declaration.
const HELP_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    followups: { type: "array", items: { type: "string" } },
    tool: { type: "string", enum: [...Object.keys(TOOL_LABELS), "none"] },
  },
  required: ["answer", "followups", "tool"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are the WORKLOG help assistant — a friendly, knowledgeable helper built into WORKLOG, a South African bookkeeping app for tradespeople, freelancers, spaza shops, hairdressers, and small business owners.

Your job: answer questions about how to use WORKLOG, give tips, and explain South African tax and labour rules as they apply to small businesses. Be warm, practical and concise — 2 to 5 sentences unless a step-by-step is genuinely needed.

Write in plain text only. Never use markdown — no **bold**, no headings, no bullet syntax. The answer is rendered as raw text, so any markup shows up as literal characters.

Never invent features. If you are not certain WORKLOG does something, say what it does do instead. In particular: WORKLOG does NOT send email. Documents (quotes, invoices, statements, payslips, remittances) are shared by saving as a PDF / printing, or via your phone's share sheet — typically WhatsApp.

WORKLOG TOOLS:
1. PRICE LIST — Items (materials, labour rates) · Cost Calculator (job costing)
2. CONTACTS — Customers · Suppliers
3. SALES — Quotes (send before the job) · Invoices (bill after) · Statements (customer account summary)
4. PURCHASES — Purchase Orders · Supplier Invoices (input VAT) · Remittance Advice
5. SCHEDULING — Diary (appointments) · Time Log (hours per client) · Trip Log (SARS per-km deduction)
6. PAYROLL — Staff Register · Pay Run (5-step wizard, calculates UIF/PAYE/SDL, generates payslips) · Advances (employee loans) · Leave (BCEA tracking)
7. MONEY — Log Income · Log Expense · Import Statement (AI reads your bank statement) · Daily Cash-Up (till reconciliation) · Cash Flow
8. TAX & COMPLIANCE — Tax & SARS · Profit & Loss · VAT201 · EMP201 · Provisional Tax (IRP6) · Age Analysis · Compliance Dashboard

KEY FACTS:
- Best starting order: Price List → Contacts → Quotes → Invoices
- Quick Log (the gold button on the home screen) is the fastest way to log anything — type, speak, or snap a photo
- VAT: set your VAT number in Tax & SARS → Business tax details. Quotes, invoices and supplier invoices then show 15% VAT automatically
- UIF: 1% employee + 1% employer, on gross wages capped at R17,712/month. It applies to EVERY employee from the first rand — there is no earnings threshold, and it is unrelated to the PAYE threshold. Due by the 7th via EMP201
- PAYE: unlike UIF, this only applies above R7,979/month. Auto-calculated in Pay Run
- SDL: 1% of gross wages, employer only, once annual payroll exceeds R500,000. Toggle it in Business tax details
- SARS mileage: R4.84/km (2025/26). Log trips in Trip Log
- Tax jar: WORKLOG sets aside 28% of every income entry as a tax provision
- BCEA leave: Annual 15 days/year (accrues 1.25/month), Sick 30 days per 3-year cycle, Family responsibility 3 days/year
- Leave tip: record leave in the Leave tool first — Pay Run then auto-suggests it
- VAT201 = output VAT (invoices) minus input VAT (supplier invoices) = what you pay SARS, due by the 25th
- EMP201 = PAYE + UIF + SDL for the month, due by the 7th
- Plans: Shoebox (R50) covers Money, basic Sales and Diary. Solo (R99) adds quotes, invoices, up to 2 staff, VAT201, provisional tax, POs. Business (R199) adds unlimited staff, full payroll, EMP201, team access.

Respond with:
- answer: your reply, in plain language
- followups: up to 2 short follow-up questions the user might want to ask next (empty array if none fit)
- tool: the single most relevant WORKLOG tool id, or "none" if no specific tool applies`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Not signed in." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "not_configured", message: "Help isn't set up yet — an administrator needs to add an ANTHROPIC_API_KEY." },
      { status: 501 }
    );
  }

  let body: HelpRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid request body." }, { status: 400 });
  }

  const messages = body.messages ?? [];
  if (!messages.length) {
    return NextResponse.json({ error: "bad_request", message: "Ask a question." }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: HELP_SCHEMA } },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "refusal", message: "Couldn't answer that one — try rephrasing." }, { status: 502 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return NextResponse.json({ error: "no_response", message: "No response from AI." }, { status: 502 });
    }

    const reply = JSON.parse(textBlock.text) as { answer: string; followups: string[]; tool: ToolId | "none" };
    return NextResponse.json({ ...reply, tool: reply.tool === "none" ? null : reply.tool });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many questions right now — try again in a moment." },
        { status: 502 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "api_error", message: "Couldn't answer that — please try again." }, { status: 502 });
    }
    return NextResponse.json({ error: "unknown", message: "Couldn't answer that — please try again." }, { status: 502 });
  }
}
