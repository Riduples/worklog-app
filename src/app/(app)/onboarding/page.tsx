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
    <div style={{ padding: "28px 20px 60px", maxWidth: 520, margin: "0 auto" }}>
      <OnboardingForm userId={user.id} userEmail={user.email ?? ""} />
    </div>
  );
}
