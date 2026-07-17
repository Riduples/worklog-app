import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile) redirect("/dashboard");

  return (
    <div style={{ padding: "40px 20px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 4 }}>Set up your business</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>
        This shows up as the &ldquo;From&rdquo; details on every quote, invoice and purchase order.
      </p>
      <OnboardingForm userId={user.id} userEmail={user.email ?? ""} />
    </div>
  );
}
