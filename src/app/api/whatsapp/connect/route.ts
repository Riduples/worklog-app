import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLinkCode } from "@/lib/whatsapp/identity";

export const runtime = "nodejs";

// In-app "Connect WhatsApp" — the logged-in owner links their WhatsApp number.
// This is the SESSION path: the cookie-based server client + RLS scope
// everything to the caller's own business (unlike the webhook, which is
// session-less and uses the service role). Owner-only, mirroring the Business
// Hub page gate.
//
//   GET    → current status: { status: "none" | "pending" | "linked", ... }
//   POST   → generate/refresh an 8-digit code (short expiry) to send to the bot
//   DELETE → disconnect (remove the link)

const CODE_TTL_MIN = 10;

type OwnerCtx =
  | { error: "unauthenticated" | "no-business" | "not-owner" }
  | { error: null; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; businessId: string };

async function ownerContext(): Promise<OwnerCtx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  // Owner-only, and scoped by user_id directly. business_profiles has
  // UNIQUE(user_id), so this returns at most ONE row — unlike an unfiltered
  // maybeSingle(), which would error for a user who belongs to more than one
  // business (a member of another) and lock them out. No owned row → they're a
  // member elsewhere or have no business: not an owner of anything to connect.
  const { data: owned } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owned) return { error: "not-owner" };

  return { error: null, supabase, userId: user.id, businessId: owned.id };
}

function denied(error: "unauthenticated" | "no-business" | "not-owner") {
  const status = error === "unauthenticated" ? 401 : 403;
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const ctx = await ownerContext();
  if (ctx.error) return denied(ctx.error);
  const { supabase, businessId } = ctx;

  const { data: link } = await supabase
    .from("whatsapp_links")
    .select("phone_e164, link_code, link_code_expires_at, verified_at")
    .eq("business_id", businessId)
    .maybeSingle();

  if (link?.verified_at && link.phone_e164) {
    return NextResponse.json({ status: "linked", phone: link.phone_e164 });
  }
  if (link?.link_code && link.link_code_expires_at && new Date(link.link_code_expires_at) > new Date()) {
    return NextResponse.json({ status: "pending", code: link.link_code, expiresAt: link.link_code_expires_at });
  }
  return NextResponse.json({ status: "none" });
}

export async function POST() {
  const ctx = await ownerContext();
  if (ctx.error) return denied(ctx.error);
  const { supabase, userId, businessId } = ctx;

  // Already linked? Don't silently blow it away — an explicit DELETE is required
  // to relink, so opening the modal and regenerating can't drop a working link.
  const { data: existing } = await supabase
    .from("whatsapp_links")
    .select("phone_e164, verified_at")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existing?.verified_at && existing.phone_e164) {
    return NextResponse.json({ status: "linked", phone: existing.phone_e164 });
  }

  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();
  const { error } = await supabase.from("whatsapp_links").upsert(
    {
      business_id: businessId,
      user_id: userId,
      link_code: code,
      link_code_expires_at: expiresAt,
      phone_e164: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "pending", code, expiresAt });
}

export async function DELETE() {
  const ctx = await ownerContext();
  if (ctx.error) return denied(ctx.error);
  const { supabase, businessId } = ctx;

  const { error } = await supabase.from("whatsapp_links").delete().eq("business_id", businessId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "none" });
}
