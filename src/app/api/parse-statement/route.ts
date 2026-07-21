import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { ALL_PAYMENT_METHODS } from "@/lib/sarsCategories";

export const runtime = "nodejs";
// Statement pages can carry a lot of transactions; the default 15s isn't enough.
export const maxDuration = 60;

type ParseStatementBody = {
  file?: { base64: string; mediaType: string };
  // Page images rasterised client-side from a password-protected PDF (decrypted
  // on the device — the PDF and its password never reach us).
  pages?: { base64: string; mediaType: string }[];
};

// Caps for the client-rasterised `pages` path. The client already keeps its
// payload under Vercel's ~4.5MB body limit; these are the server's own guard
// against an oversized or abusive array (token/cost/memory blowup).
const MAX_PAGES = 12;
const MAX_IMAGE_BASE64 = 1_500_000; // ~1.1MB decoded per page
const MAX_TOTAL_BASE64 = 5_000_000; // ~3.7MB decoded across the whole request

function looksLikeJpeg(base64: string): boolean {
  try {
    const head = Buffer.from(base64.slice(0, 16), "base64");
    return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  } catch {
    return false;
  }
}

const TRANSACTIONS_SCHEMA = {
  type: "object",
  properties: {
    statement: {
      type: "object",
      properties: {
        bank_name: { type: "string" },
        account_number: { type: "string" },
      },
      required: ["bank_name", "account_number"],
      additionalProperties: false,
    },
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          type: { type: "string", enum: ["income", "expense"] },
          amount: { type: "number" },
          method: { type: "string", enum: ALL_PAYMENT_METHODS },
          category: { type: "string" },
          confidence: { type: "string", enum: ["high", "low"] },
        },
        required: ["date", "description", "type", "amount", "method", "category", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["statement", "transactions"],
  additionalProperties: false,
} as const;

function buildSystemPrompt(contactNames: string[]) {
  return `You are a South African bank statement parser. Extract ALL transactions from the supplied bank statement image or PDF.

Known contacts already saved: ${contactNames.join(", ") || "none"}

Rules:
- date: "YYYY-MM-DD". If only day/month is shown, infer the year from the statement period.
- description: a clean, short description — strip bank codes and long reference numbers.
- type: "income" for credits/deposits/money received, "expense" for debits/purchases/money paid out.
- amount: a positive number, no currency symbol, regardless of type.
- method: exactly one of: ${ALL_PAYMENT_METHODS.join(", ")}
- category: the best-guess SARS category, e.g. "Trading income", "Materials", "Fuel", "Telephone", "Rent", "Wages", "Bank charges", "Insurance".
- confidence: "high" if the row is clearly legible, "low" if you had to guess any field.
- If the statement is supplied as several images, they are consecutive pages of ONE statement, in order. Read them as one continuous statement, keep the dates in order, and do not double-count header rows or opening/closing balances that repeat across pages.

Also read the statement header:
- statement.bank_name: the bank name shown (e.g. "FNB", "Standard Bank", "Capitec"), or "" if not visible.
- statement.account_number: the account number shown — the last 4 digits are enough; return "" if not visible.

Extract every transaction you can see — do not skip any. Include unclear rows with confidence "low" rather than dropping them.`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Not signed in." }, { status: 401 });
  }

  // Before the model call, and before we read a whole PDF into memory. This is
  // the dearest of the four: a full statement in, up to 8k tokens out.
  const limited = await enforceRateLimit(supabase, "parse-statement");
  if (limited) return limited;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "Statement import isn't set up yet — an administrator needs to add an ANTHROPIC_API_KEY.",
      },
      { status: 501 }
    );
  }

  let body: ParseStatementBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid request body." }, { status: 400 });
  }
  // request.json() returns null for a literal `null` body without throwing.
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request", message: "Invalid request body." }, { status: 400 });
  }

  // Two request shapes normalise to one array of content blocks: a single native
  // file (image or unencrypted PDF), or an array of page images from a decrypted
  // password-protected PDF. Validate whichever we got before touching the DB or model.
  let contentBlocks: Anthropic.ContentBlockParam[];

  if (Array.isArray(body.pages) && body.pages.length > 0) {
    const pages = body.pages;
    if (pages.length > MAX_PAGES) {
      return NextResponse.json(
        { error: "too_large", message: "That statement has too many pages to import at once — try fewer pages." },
        { status: 400 }
      );
    }
    let total = 0;
    for (const p of pages) {
      if (!p || typeof p.base64 !== "string" || p.mediaType !== "image/jpeg" || !looksLikeJpeg(p.base64)) {
        return NextResponse.json({ error: "bad_request", message: "Those statement pages weren't valid." }, { status: 400 });
      }
      if (p.base64.length > MAX_IMAGE_BASE64) {
        return NextResponse.json({ error: "too_large", message: "One of the pages is too large." }, { status: 400 });
      }
      total += p.base64.length;
    }
    if (total > MAX_TOTAL_BASE64) {
      return NextResponse.json(
        { error: "too_large", message: "That statement is too large to import at once — try fewer pages." },
        { status: 400 }
      );
    }
    contentBlocks = pages.map((p) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: p.base64 },
    }));
  } else {
    const file = body.file;
    if (!file || typeof file.base64 !== "string" || typeof file.mediaType !== "string") {
      return NextResponse.json({ error: "bad_request", message: "Attach a statement file." }, { status: 400 });
    }
    const isImage = file.mediaType.startsWith("image/");
    const isPdf = file.mediaType === "application/pdf";
    if (!isImage && !isPdf) {
      return NextResponse.json(
        { error: "bad_request", message: "Upload a PDF or a photo of your statement." },
        { status: 400 }
      );
    }
    contentBlocks = [
      isImage
        ? {
            type: "image",
            source: {
              type: "base64",
              media_type: file.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: file.base64,
            },
          }
        : { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } },
    ];
  }

  // Contact names are read server-side; never trust a client-supplied list.
  const { data: contacts } = await supabase.from("contacts").select("name").is("deleted_at", null);
  const contactNames = (contacts ?? []).map((c) => c.name);

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      // Headroom for a busy multi-page statement. You only pay for tokens actually
      // generated, so a higher cap is free unless the statement is genuinely long.
      max_tokens: 16000,
      system: buildSystemPrompt(contactNames),
      output_config: { format: { type: "json_schema", schema: TRANSACTIONS_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [...contentBlocks, { type: "text", text: "Extract every transaction from this bank statement." }],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "refusal", message: "Couldn't read that statement — try a clearer photo or the PDF." },
        { status: 502 }
      );
    }

    // The response was cut off mid-JSON. Say so instead of failing the JSON.parse
    // with an opaque error — this is the "very long statement" case.
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        {
          error: "too_long",
          message: "That statement has more transactions than we can read in one go — try importing fewer pages at a time.",
        },
        { status: 502 }
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return NextResponse.json({ error: "no_response", message: "No response from AI." }, { status: 502 });
    }

    let parsed: { transactions: { amount: number }[]; statement?: { bank_name?: string; account_number?: string } };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json(
        { error: "bad_response", message: "Couldn't read that statement — try a clearer photo or the PDF." },
        { status: 502 }
      );
    }
    const { transactions, statement } = parsed;
    if (!transactions?.length) {
      return NextResponse.json(
        { error: "no_transactions", message: "No transactions found in that file." },
        { status: 502 }
      );
    }

    // The model is told to return positives, but a statement's own minus signs
    // leak through often enough to be worth normalising here.
    const normalised = transactions.map((t) => ({ ...t, amount: Math.abs(Number(t.amount) || 0) }));
    return NextResponse.json({ transactions: normalised, statement: statement ?? null });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests right now — try again in a moment." },
        { status: 502 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "api_error", message: "Couldn't read that statement — try a clearer photo or the PDF." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "unknown", message: "Couldn't read that statement — try a clearer photo or the PDF." },
      { status: 502 }
    );
  }
}
