import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { ALL_PAYMENT_METHODS } from "@/lib/sarsCategories";

export const runtime = "nodejs";

type QuickLogRequestBody = {
  text?: string;
  image?: { base64: string; mediaType: string };
};

// One entry can be any of these. The inline actions save straight into their
// table; "handoff" is the escape hatch for anything that needs a full document
// or multi-step flow Quick Log can't finish in one shot (invoices, payroll, tax).
const QUICK_LOG_ACTIONS = [
  "income",
  "expense",
  "booking",
  "stock",
  "mileage",
  "time",
  "contact",
  "handoff",
] as const;

type QuickLogDraft = {
  action: (typeof QUICK_LOG_ACTIONS)[number];
  confidence: "high" | "low";
  amount: number | null;
  whatFor: string;
  person: string;
  method: string;
  date: string;
  time: string;
  quantity: number | null;
  km: number | null;
  hours: number | null;
  contactType: string;
  phone: string;
  suggestedTool: string;
};

// Every field is required so the model always returns a complete, concretely-typed
// object; irrelevant fields come back as "" or null per the prompt's instructions.
const QUICK_LOG_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: QUICK_LOG_ACTIONS },
    confidence: { type: "string", enum: ["high", "low"] },
    amount: { type: ["number", "null"] },
    whatFor: { type: "string" },
    person: { type: "string" },
    method: { type: "string", enum: ALL_PAYMENT_METHODS },
    date: { type: "string" },
    time: { type: "string" },
    quantity: { type: ["number", "null"] },
    km: { type: ["number", "null"] },
    hours: { type: ["number", "null"] },
    contactType: { type: "string", enum: ["client", "supplier", ""] },
    phone: { type: "string" },
    suggestedTool: { type: "string" },
  },
  required: [
    "action",
    "confidence",
    "amount",
    "whatFor",
    "person",
    "method",
    "date",
    "time",
    "quantity",
    "km",
    "hours",
    "contactType",
    "phone",
    "suggestedTool",
  ],
  additionalProperties: false,
} as const;

// The instructions are identical for every user on every request, so they live in
// a module-level constant and go in the FIRST system block with cache_control. That
// makes them a stable, cacheable prefix — the per-user context (today's date, the
// user's own contacts/stock) goes in a second, uncached block after it, so it can
// vary without invalidating the cached instructions. On Haiku 4.5 the cache only
// engages once this prefix clears ~4096 tokens and the 5-minute window stays warm —
// which the modal's stay-open, log-several-in-a-row flow is well suited to.
const STATIC_SYSTEM = `You are Worklog's Quick Log assistant. Worklog is an all-in-one bookkeeping and business app for South African small and informal businesses — tradespeople, plumbers, electricians, hairdressers, spaza shops, caterers, freelancers and gig workers.

Your job: read one short description of something that happened in the business — typed, spoken (so expect casual, phonetic phrasing), or read from a photo of a receipt, invoice or note — and turn it into exactly ONE structured action. Be forgiving of typos, SMS-style spelling, and mixed English, Afrikaans, isiZulu, isiXhosa, Sesotho and other South African languages. Rand amounts may be written "R450", "450", "450 rand", "R1,200", "1.2k" and so on.

Choose exactly one action:
- "income" — money coming IN to the business (a sale, a payment received, a deposit). Use this whenever money was actually received, even if it relates to a job or appointment.
- "expense" — money going OUT of the business (a purchase, a payment made, fuel, materials, a bill). A photographed till slip or supplier receipt is almost always an expense.
- "booking" — a future appointment or job scheduled for a client, where no money has necessarily changed hands yet ("book", "appointment", "coming in on", "schedule", a day/time set aside for someone).
- "stock" — adding an item or quantity to inventory / the price list ("add", "got in", "received stock", "X units of Y").
- "mileage" — a business trip that was driven, described in kilometres ("drove", "trip to", "Xkm to ...").
- "time" — hours worked on a job or for a client that should be logged ("X hours", "worked on ...", "spent the morning ...").
- "contact" — a new client or supplier to save, given by name (and maybe a phone number), with no money, appointment, stock, trip or hours attached ("add a new client/customer/supplier ...", "save ...'s number").
- "handoff" — anything that needs a full Worklog document or multi-step process Quick Log cannot finish in a single entry: creating or sending an invoice or quote, a purchase order, a supplier invoice, a customer statement, running payroll / a payslip, adding a staff member, or filing / calculating VAT or tax. Do NOT try to build these yourself — set action to "handoff" and set suggestedTool.

Disambiguation:
- Money received or paid always wins over "booking" or "time": "Sarah paid R500 for today's appointment" is income, not a booking.
- "booking" is only for a scheduled appointment where no payment is stated.
- "Send/make/create/do an invoice (or quote) for ..." is a "handoff" (suggestedTool "invoice" or "quote"), NOT income — an invoice is a document to raise, not money received yet.
- When someone buys stock and pays for it now, prefer "expense" if the point is the money spent, and "stock" if the point is adding quantity to inventory.

Fill EVERY field. Use "" for text fields and null for number fields that do not apply to the chosen action.

Fields:
- action: one of the values above.
- confidence: "high" if the action and details are clear, "low" if you had to guess.
- amount: the rand figure as a number only, no symbols. For income/expense it is the transaction total (for a photo, the TOTAL). For "booking" it is the agreed price if stated. For "stock" it is the per-unit price if stated. null if there is none.
- whatFor: a short plain description — what the income/expense was for; the service for a booking; the item name for stock; the purpose of a mileage trip; the work done for a time entry. "" if none.
- person: the name of the other party — who paid (income), who was paid (expense), the client for a booking or time entry, or the name of a new contact. Match to a known contact's exact name when it is clearly the same person or business. "" if none.
- method: for income/expense, exactly one of: ${ALL_PAYMENT_METHODS.join(", ")}. For any other action just use "Cash" (it is ignored).
- date: the date the booking/trip/time entry is for, as YYYY-MM-DD. Resolve relative words ("today", "tomorrow", "Friday", "next Monday") against the current date given below. "" if none or not applicable.
- time: for a booking, the time of day as 24-hour HH:MM (e.g. "2pm" becomes "14:00"). "" if none.
- quantity: for "stock", the number of units. null otherwise.
- km: for "mileage", the distance in kilometres as a number. null otherwise.
- hours: for "time", the hours worked as a number. null otherwise.
- contactType: for "contact", "client" for a customer they sell to or "supplier" for someone they buy from; default "client" if unclear. "" for every other action.
- phone: for "contact", the phone number if given, digits and spaces as written. "" otherwise.
- suggestedTool: for "handoff" ONLY, one of: "invoice", "quote", "purchaseorder", "supplierinvoice", "statement", "payroll", "staff", "tax". "" for every other action.

Examples:
- "R450 cash from Thabo for fixing the gate" -> action "income", amount 450, whatFor "fixing the gate", person "Thabo", method "Cash".
- "bought R220 fuel at engen, card" -> action "expense", amount 220, whatFor "fuel", person "Engen", method "Card".
- "book mrs khumalo friday 2pm for a wash and blow, R350" -> action "booking", person "Mrs Khumalo", whatFor "wash and blow", date (that Friday), time "14:00", amount 350.
- "add 20 bags of cement at R80 each" -> action "stock", whatFor "cement", quantity 20, amount 80.
- "drove 45km to sandton for a site visit" -> action "mileage", km 45, whatFor "site visit", date (today).
- "3 hours plumbing for the Dlamini job today" -> action "time", hours 3, whatFor "plumbing", person "Dlamini", date (today).
- "add a new supplier, BuildIt, 0123456789" -> action "contact", person "BuildIt", contactType "supplier", phone "0123456789".
- "make an invoice for Sipho for R2000" -> action "handoff", suggestedTool "invoice".
- "run this month's payslips" -> action "handoff", suggestedTool "payroll".`;

function buildContext(contactNames: string[], stockNames: string[]): string {
  // SAST is UTC+2 year-round (no DST), so shift then read in UTC to get the
  // South African calendar date and weekday for relative-date resolution.
  const saNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const todayISO = saNow.toISOString().slice(0, 10);
  const weekday = saNow.toLocaleDateString("en-ZA", { weekday: "long", timeZone: "UTC" });
  return `Current date: ${todayISO} (${weekday}), South Africa.
Known contacts already saved: ${contactNames.join(", ") || "none"}.
Known stock items: ${stockNames.join(", ") || "none"}.`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Not signed in." }, { status: 401 });
  }

  // Before the model call, because the point is to not spend the money.
  const limited = await enforceRateLimit(supabase, "quick-log");
  if (limited) return limited;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "Quick Log isn't set up yet — an administrator needs to add an ANTHROPIC_API_KEY.",
      },
      { status: 501 }
    );
  }

  let body: QuickLogRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid request body." }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  const image = body.image;
  if (!text && !image) {
    return NextResponse.json(
      { error: "bad_request", message: "Describe what happened or attach a photo." },
      { status: 400 }
    );
  }

  const [contactsResult, stockResult] = await Promise.all([
    supabase.from("contacts").select("name").is("deleted_at", null),
    supabase.from("stock_items").select("name").is("deleted_at", null),
  ]);
  const contactNames = (contactsResult.data ?? []).map((c) => c.name);
  const stockNames = (stockResult.data ?? []).map((s) => s.name);

  const userContent: Anthropic.MessageParam["content"] = image
    ? [
        { type: "image", source: { type: "base64", media_type: image.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: image.base64 } },
        {
          type: "text",
          text: text ? `Additional context: ${text}` : "Extract the transaction from this receipt, invoice or document.",
        },
      ]
    : text;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: [
        { type: "text", text: STATIC_SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: buildContext(contactNames, stockNames) },
      ],
      output_config: { format: { type: "json_schema", schema: QUICK_LOG_SCHEMA } },
      messages: [{ role: "user", content: userContent }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "refusal", message: "Couldn't read that — please try again or type it manually." },
        { status: 502 }
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return NextResponse.json({ error: "no_response", message: "No response from AI." }, { status: 502 });
    }

    const draft = JSON.parse(textBlock.text) as QuickLogDraft;
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests right now — try again in a moment." },
        { status: 502 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "api_error", message: "Couldn't read that — please try again or type it manually." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "unknown", message: "Couldn't read that — please try again or type it manually." },
      { status: 502 }
    );
  }
}
