"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { LEGAL_VERSION } from "@/lib/legal/company";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    // The button is disabled until this is true, but never trust the UI alone —
    // the terms acceptance is the whole point of the gate.
    if (!agreed) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    // Record which version of the terms the user accepted, and when. Stored in
    // the account's metadata so we have a durable record of demonstrable assent
    // (ECTA) — bump LEGAL_VERSION whenever the documents materially change.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { terms_version: LEGAL_VERSION, terms_accepted_at: new Date().toISOString() } },
    });
    setLoading(false);
    if (error) {
      // Some auth failures (e.g. a 500 when the confirmation email can't be
      // sent) come back with an empty or "{}" message — never surface that raw.
      const raw = error.message?.trim();
      setError(raw && raw !== "{}" ? raw : "We couldn't create your account just now — please try again in a moment.");
      return;
    }
    // If email confirmation is enabled in Supabase Auth settings, signUp()
    // returns no session yet — the user must confirm via email before login.
    if (!data.session) {
      setNeedsConfirmation(true);
      return;
    }
    // Skip onboarding (which creates the user's own business) when they
    // signed up specifically to accept an invite into someone else's business.
    router.push(next || "/onboarding");
    router.refresh();
  };

  if (needsConfirmation) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 12 }}>Almost there</h1>
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#0369A1" }}>
          We sent a confirmation link to <strong>{email}</strong>. Confirm your email, then log in.
        </div>
        <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 20 }}>
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            style={{ color: "#0C4A6E", fontWeight: 700 }}
          >
            Back to login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 4 }}>Create your account</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>Start logging every rand and every job.</p>

      <form onSubmit={handleSignup}>
        <Field label="Email">
          <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" required autoFocus />
        </Field>
        <Field label="Password">
          <Input value={password} onChange={setPassword} placeholder="At least 6 characters" type="password" required />
        </Field>
        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", margin: "4px 0 16px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: "#0C4A6E", cursor: "pointer" }}
          />
          <span style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
            I agree to Worklog&apos;s{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#0C4A6E", fontWeight: 700 }}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#0C4A6E", fontWeight: 700 }}>
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <SaveBtn type="submit" label={loading ? "Creating account..." : "Sign up"} icon="🚀" disabled={loading || !agreed} />
      </form>

      <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 20 }}>
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          style={{ color: "#0C4A6E", fontWeight: 700 }}
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
