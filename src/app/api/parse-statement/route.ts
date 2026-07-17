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
};

const TRANSACTIONS_SCHEMA = {
  type: "object",
  properties: {
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
  required: ["transactions"],
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

  const file = body.file;
  if (!file?.base64 || !file.mediaType) {
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

  // Contact names are read server-side; never trust a client-supplied list.
  const { data: contacts } = await supabase.from("contacts").select("name").is("deleted_at", null);
  const contactNames = (contacts ?? []).map((c) => c.name);

  const contentBlock: Anthropic.ContentBlockParam = isImage
    ? {
        type: "image",
        source: {
          type: "base64",
          media_type: file.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: file.base64,
        },
      }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } };

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8000,
      system: buildSystemPrompt(contactNames),
      output_config: { format: { type: "json_schema", schema: TRANSACTIONS_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: "Extract every transaction from this bank statement." }],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "refusal", message: "Couldn't read that statement — try a clearer photo or the PDF." },
        { status: 502 }
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return NextResponse.json({ error: "no_response", message: "No response from AI." }, { status: 502 });
    }

    const { transactions } = JSON.parse(textBlock.text) as {
      transactions: { amount: number }[];
    };
    if (!transactions?.length) {
      return NextResponse.json(
        { error: "no_transactions", message: "No transactions found in that file." },
        { status: 502 }
      );
    }

    // The model is told to return positives, but a statement's own minus signs
    // leak through often enough to be worth normalising here.
    const normalised = transactions.map((t) => ({ ...t, amount: Math.abs(Number(t.amount) || 0) }));
    return NextResponse.json({ transactions: normalised });
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
