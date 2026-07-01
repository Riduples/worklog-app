"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is enabled in Supabase Auth settings, signUp()
    // returns no session yet — the user must confirm via email before login.
    if (!data.session) {
      setNeedsConfirmation(true);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  };

  if (needsConfirmation) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", marginBottom: 12 }}>Almost there</h1>
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#166534" }}>
          We sent a confirmation link to <strong>{email}</strong>. Confirm your email, then log in.
        </div>
        <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 20 }}>
          <Link href="/login" style={{ color: "#1B4332", fontWeight: 700 }}>
            Back to login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", marginBottom: 4 }}>Create your account</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>Start logging every rand and every job.</p>

      <form onSubmit={handleSignup}>
        <Field label="Email">
          <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" required autoFocus />
        </Field>
        <Field label="Password">
          <Input value={password} onChange={setPassword} placeholder="At least 6 characters" type="password" required />
        </Field>
        {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <SaveBtn type="submit" label={loading ? "Creating account..." : "Sign up"} icon="🚀" disabled={loading} />
      </form>

      <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 20 }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#1B4332", fontWeight: 700 }}>
          Log in
        </Link>
      </p>
    </div>
  );
}
