import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { TOOL_LABELS, type ToolId } from "@/lib/permissions";
import { TAX_RATES } from "@/lib/taxRates";
import { TIERS } from "@/lib/tiers";
import { HELP_KNOWLEDGE, HELP_SLUGS } from "@/lib/help/knowledge";

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
    // The single Help Centre guide that best answers this, so Loggy can offer a
    // "read the full guide" link. Constrained to real slugs (+ "none") so it can
    // never point at a /help URL that doesn't exist.
    guideSlug: { type: "string", enum: [...HELP_SLUGS, "none"] },
  },
  required: ["answer", "followups", "tool", "guideSlug"],
  additionalProperties: false,
} as const;

// Every rate below is interpolated from the same constants the app calculates
// with, never typed as prose. The assistant is the one place a stale figure is
// invisible — a wrong number in a report gets noticed, a wrong number in
// friendly advice just gets believed. Percentages are formatted rather than
// written out so a rate change can't leave the words disagreeing with the maths.
const pct = (r: number) => `${(r * 100).toFixed(0)}%`;
const rand = (n: number) => `R${n.toLocaleString("en-ZA")}`;

const SYSTEM_PROMPT = `You are Loggy, the friendly help assistant built into Worklog — a South African bookkeeping app for tradespeople, freelancers, spaza shops, hairdressers, and small business owners. Loggy is Worklog's mascot: a cheerful orange spiral notebook. Keep that warm, encouraging personality, but stay brief and useful — never role-play at length or let the character get in the way of a clear answer.

Your job: answer questions about how to use Worklog, give tips, and explain South African tax and labour rules as they apply to small businesses. Be warm, practical and concise — 2 to 5 sentences unless a step-by-step is genuinely needed.

You have Worklog's full Help Centre below as your knowledge base — the same step-by-step guides users can read at /help. Ground every answer in those guides and the facts below; prefer what the guides say over your own assumptions, and match the exact tool and button names they use. When a single guide answers the question, set guideSlug to that guide's slug so the user can open the full guide; if no one guide fits, set guideSlug to "none". Only ever use a slug that appears in the guides provided.

Worklog provides record-keeping tools, not tax advice. Explain the rules in general terms, but never give personalised tax, legal or financial advice, and never guarantee an outcome (e.g. that someone won't be audited or penalised). For anything specific to their situation, point them to SARS or a registered accountant or tax practitioner.

Write in plain text only. Never use markdown — no **bold**, no headings, no bullet syntax. The answer is rendered as raw text, so any markup shows up as literal characters.

Never invent features. If you are not certain Worklog does something, say what it does do instead. In particular: Worklog does NOT send email. Documents (quotes, invoices, statements, payslips, remittances) are shared by saving as a PDF / printing, or via your phone's share sheet — typically WhatsApp.

Worklog TOOLS:
1. PRICE LIST — Items (your saved prices for everything you sell and use: services, products, materials, labour, packages) · Cost Calculator (job costing)
2. CONTACTS — Customers (people/businesses you sell to; track their payment behaviour) · Suppliers (people/businesses you buy from; track their payment terms and bank details). Each is its own list with search, sort and payment filters
3. SALES — Quotes (send before the job) · Invoices (bill after) · Statements (customer account summary) · Age Analysis (what customers still owe you, aged by overdue days)
4. PURCHASES — Purchase Orders · Supplier Invoices (input VAT) · Remittance Advice · Age Analysis (what you still owe suppliers, aged by overdue days)
5. SCHEDULING — Diary (appointments) · Time Log (hours per customer) · Travel Log (SARS per-km deduction) · Time & Travel Reports (Hours vs Estimate + Travel)
6. PAYROLL — Staff Register · Pay Run (5-step wizard, calculates UIF/PAYE/SDL, generates payslips) · Advances (employee loans) · Leave (BCEA tracking)
7. MONEY — Log Income · Log Expense · Import Statement (AI reads your bank statement) · Cash-ups (counting your cash against what you logged) · Cash Flow
8. COMPLIANCE & FINANCIALS — Tax & SARS · Profit & Loss · VAT201 · EMP201 · Provisional Tax (IRP6) · Compliance Dashboard

KEY FACTS:
- Best starting order: Price List → Contacts → Quotes → Invoices
- Quick Log (the gold button on the home screen) is the fastest way to log anything — type, speak, or snap a photo
- VAT: set your VAT number in Tax & SARS → Business tax details. Quotes, invoices and supplier invoices then show ${pct(TAX_RATES.VAT_RATE)} VAT automatically. Cash income you log is treated as VAT-inclusive — Worklog works the VAT out of it for your VAT201
- UIF: ${pct(TAX_RATES.UIF_EMPLOYEE_RATE)} employee + ${pct(TAX_RATES.UIF_EMPLOYER_RATE)} employer, on gross wages capped at ${rand(TAX_RATES.UIF_CEILING)}/month. It applies to EVERY employee from the first rand — there is no earnings threshold, and it is unrelated to the PAYE threshold. Due by the 7th via EMP201
- PAYE: unlike UIF, this only applies above ${rand(TAX_RATES.PAYE_MONTHLY_THRESHOLD)}/month. Auto-calculated in Pay Run
- SDL: ${pct(TAX_RATES.SDL_RATE)} of gross wages, employer only, once annual payroll exceeds R500,000. Toggle it in Business tax details
- SARS mileage: R${TAX_RATES.MILEAGE_RATE}/km (${TAX_RATES.TAX_YEAR}). Log trips in Travel Log
- Tax jar: Worklog sets aside ${pct(TAX_RATES.TAX_JAR_RATE)} of every income entry as an income tax provision (on the amount after VAT, if you are VAT-registered). See it in Tax & SARS → Tax Jar
- BCEA leave: Annual 15 days/year (accrues 1.25/month), Sick 30 days per 3-year cycle, Family responsibility 3 days/year
- Leave tip: record leave in the Leave tool first — Pay Run then auto-suggests it
- VAT201 = output VAT (invoices) minus input VAT (supplier invoices) = what you pay SARS, due by the 25th
- EMP201 = PAYE + UIF + SDL for the month, due by the 7th
- Plans: Solo (${TIERS.solo.price}) covers your money — income, expenses, quotes, invoices, cash-up and receipts for a one-person business. Trade (${TIERS.trade.price}) adds up to 5 staff logins, staff register & payroll, purchase orders, supplier invoices and age analysis (customers and suppliers). Structured (${TIERS.structured.price}) adds VAT201/EMP201 tracking, provisional tax, the compliance dashboard and the accountant pack. All prices include VAT.

Respond with:
- answer: your reply, in plain language
- followups: up to 2 short follow-up questions the user might want to ask next (empty array if none fit)
- tool: the single most relevant Worklog tool id, or "none" if no specific tool applies
- guideSlug: the slug of the single Help Centre guide that best answers this question, or "none" (must be a slug from the guides below)`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Not signed in." }, { status: 401 });
  }

  // Before the model call, because the point is to not spend the money.
  const limited = await enforceRateLimit(supabase, "help-assistant");
  if (limited) return limited;

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
      // Two stable system blocks; cache_control on the (large) knowledge block
      // caches the whole prefix for ~5 minutes (the default ephemeral TTL), so a
      // burst of questions — the common case, a few asked in a row — reads the
      // corpus at a tenth of the price after the first. The corpus is far above
      // Haiku's cache-write floor, unlike our tiny Quick Log prompt.
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        {
          type: "text",
          text: `WORKLOG HELP CENTRE — the full guides, your knowledge base:\n\n${HELP_KNOWLEDGE}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: { type: "json_schema", schema: HELP_SCHEMA } },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "refusal", message: "Couldn't answer that one — try rephrasing." }, { status: 502 });
    }
    // A structured-output answer cut off at the token cap is invalid JSON; catch
    // it here with a clear message rather than letting it fall through as a
    // confusing generic error (and it would fail identically on retry).
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "too_long", message: "That got long — try asking something more specific." }, { status: 502 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return NextResponse.json({ error: "no_response", message: "No response from AI." }, { status: 502 });
    }

    let reply: { answer: string; followups: string[]; tool: ToolId | "none"; guideSlug: string | "none" };
    try {
      reply = JSON.parse(textBlock.text);
    } catch {
      console.error("help-assistant: could not parse model JSON:", textBlock.text.slice(0, 500));
      return NextResponse.json({ error: "bad_response", message: "Couldn't answer that — please try again." }, { status: 502 });
    }
    return NextResponse.json({
      ...reply,
      tool: reply.tool === "none" ? null : reply.tool,
      guideSlug: reply.guideSlug === "none" ? null : reply.guideSlug,
    });
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
