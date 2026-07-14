import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { ALL_PAYMENT_METHODS } from "@/lib/sarsCategories";

export const runtime = "nodejs";

type QuickLogRequestBody = {
  text?: string;
  image?: { base64: string; mediaType: string };
};

type QuickLogDraft = {
  type: "income" | "expense";
  amount: number | null;
  whatFor: string;
  person: string;
  method: string;
  confidence: "high" | "low";
};

const QUICK_LOG_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["income", "expense"] },
    amount: { type: ["number", "null"] },
    whatFor: { type: "string" },
    person: { type: "string" },
    method: { type: "string", enum: ALL_PAYMENT_METHODS },
    confidence: { type: "string", enum: ["high", "low"] },
  },
  required: ["type", "amount", "whatFor", "person", "method", "confidence"],
  additionalProperties: false,
} as const;

function buildSystemPrompt(contactNames: string[], stockNames: string[]) {
  return `You are a bookkeeping assistant for South African informal workers (tradespeople, freelancers, spaza shops, hairdressers, gig workers, etc). Your job is to read a description of a money transaction — which may come from typed text, spoken words, or a photo of a receipt or invoice — and convert it into structured data. Be forgiving of typos, mixed languages, Afrikaans, Zulu, Sotho, and casual phrasing.

Known contacts already saved: ${contactNames.join(", ") || "none"}
Known stock items: ${stockNames.join(", ") || "none"}

Rules:
- type: "income" (money IN) or "expense" (money OUT)
- amount: number only, no currency symbol. For receipts/photos, extract the TOTAL amount. If no clear amount, set to null.
- whatFor: short plain description of what the transaction was for
- person: name of who paid them (income) or who they paid (expense). Match to a known contact by name if it's clearly the same person/business.
- method: exactly one of: ${ALL_PAYMENT_METHODS.join(", ")}
- confidence: "high" if clear, "low" if guessed`;
}

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
      { error: "bad_request", message: "Describe the transaction or attach a photo." },
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
          text: text ? `Additional context: ${text}` : "Please extract the transaction details from this receipt, invoice or document.",
        },
      ]
    : text;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: buildSystemPrompt(contactNames, stockNames),
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
