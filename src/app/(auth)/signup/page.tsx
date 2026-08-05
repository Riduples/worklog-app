import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";
import { SignupClosed } from "@/components/auth/SignupClosed";
import { createClient } from "@/lib/supabase/server";

// Registrations can be paused globally (platform_settings.signups_enabled). The
// database enforces the block regardless; this just shows a friendly closed page
// instead of a form that would fail. Fail closed: only an explicit `true` opens
// the form, so a failed read shows the closed state rather than a doomed form.
export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("signups_enabled").limit(1).maybeSingle();
  if (data?.signups_enabled !== true) return <SignupClosed />;

  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
