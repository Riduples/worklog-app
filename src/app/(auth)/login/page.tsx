"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMagicLinkSent(true);
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", marginBottom: 4 }}>Welcome back</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>Log in to your WORKLOG account.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setError("");
          }}
          style={{
            flex: 1,
            padding: "9px 0",
            borderRadius: 10,
            border: `1.5px solid ${mode === "password" ? "#1B4332" : "#e2e8f0"}`,
            background: mode === "password" ? "#1B4332" : "#fff",
            color: mode === "password" ? "#fff" : "#374151",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("magic-link");
            setError("");
          }}
          style={{
            flex: 1,
            padding: "9px 0",
            borderRadius: 10,
            border: `1.5px solid ${mode === "magic-link" ? "#1B4332" : "#e2e8f0"}`,
            background: mode === "magic-link" ? "#1B4332" : "#fff",
            color: mode === "magic-link" ? "#fff" : "#374151",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Magic link
        </button>
      </div>

      {magicLinkSent ? (
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#166534" }}>
          Check your email — we sent a login link to <strong>{email}</strong>.
        </div>
      ) : mode === "password" ? (
        <form onSubmit={handlePasswordLogin}>
          <Field label="Email">
            <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" required autoFocus />
          </Field>
          <Field label="Password">
            <Input value={password} onChange={setPassword} placeholder="••••••••" type="password" required />
          </Field>
          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <SaveBtn type="submit" label={loading ? "Logging in..." : "Log in"} icon="🔑" disabled={loading} />
        </form>
      ) : (
        <form onSubmit={handleMagicLink}>
          <Field label="Email">
            <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" required autoFocus />
          </Field>
          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <SaveBtn type="submit" label={loading ? "Sending..." : "Send magic link"} icon="✨" disabled={loading} />
        </form>
      )}

      <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 20 }}>
        No account yet?{" "}
        <Link href="/signup" style={{ color: "#1B4332", fontWeight: 700 }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
