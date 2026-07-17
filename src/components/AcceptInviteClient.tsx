"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Preview = {
  business_name: string;
  role: string;
  invite_email: string;
  is_expired: boolean;
  is_accepted: boolean;
};

const shell = (children: React.ReactNode) => (
  <div
    style={{
      minHeight: "100vh",
      background: "#F0F9FF",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      padding: 20,
    }}
  >
    <div style={{ width: "100%", maxWidth: 380 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
        {/* Light background, so the logotype's own dark wordmark is right here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/worklog-logo.png" alt="Worklog" style={{ height: 38, width: "auto", display: "block" }} />
      </div>
      <div style={{ background: "#fff", borderRadius: 18, padding: "28px 24px", boxShadow: "0 4px 16px rgba(12,74,110,0.1)" }}>
        {children}
      </div>
    </div>
  </div>
);

export function AcceptInviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(!!token);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    const supabase = createClient();
    (async () => {
      const [{ data: previewRows }, { data: userData }] = await Promise.all([
        supabase.rpc("get_invite_preview", { p_token: token }),
        supabase.auth.getUser(),
      ]);
      setPreview((previewRows?.[0] as Preview) ?? null);
      setCurrentEmail(userData.user?.email ?? null);
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("accept_invite", { p_token: token });
    if (rpcError) {
      setError(rpcError.message);
      setAccepting(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  if (!token) {
    return shell(
      <>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>Invalid invite link</h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>This link is missing an invite token.</p>
      </>
    );
  }

  if (loading) {
    return shell(<p style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>Loading invite...</p>);
  }

  if (!preview) {
    return shell(
      <>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>Invite not found</h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>This invite link isn&apos;t valid. Ask for a new one.</p>
      </>
    );
  }

  if (preview.is_accepted) {
    return shell(
      <>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>Already used</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>This invite has already been accepted.</p>
        <Link href="/login" style={{ color: "#0C4A6E", fontWeight: 700, fontSize: 13 }}>
          Log in
        </Link>
      </>
    );
  }

  if (preview.is_expired) {
    return shell(
      <>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>Invite expired</h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          This invite has expired. Ask the business owner for a new one.
        </p>
      </>
    );
  }

  const nextParam = encodeURIComponent(`/accept-invite?token=${token}`);
  const emailMismatch = currentEmail && currentEmail.toLowerCase() !== preview.invite_email.toLowerCase();

  return shell(
    <>
      <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>You&apos;re invited</h1>
      <p style={{ fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 1.5 }}>
        Join <strong>{preview.business_name}</strong> on Worklog as a <strong style={{ textTransform: "capitalize" }}>{preview.role}</strong>.
      </p>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {!currentEmail ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href={`/signup?next=${nextParam}`}
            style={{
              background: "#0C4A6E",
              color: "#fff",
              borderRadius: 12,
              padding: "13px",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Sign up to accept
          </Link>
          <Link
            href={`/login?next=${nextParam}`}
            style={{
              background: "#f1f5f9",
              color: "#374151",
              borderRadius: 12,
              padding: "13px",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Already have an account? Log in
          </Link>
        </div>
      ) : emailMismatch ? (
        <div style={{ background: "#fff7ed", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
          This invite was sent to <strong>{preview.invite_email}</strong>, but you&apos;re logged in as{" "}
          <strong>{currentEmail}</strong>. Log out and use the invited email address to accept.
        </div>
      ) : (
        <button
          onClick={handleAccept}
          disabled={accepting}
          style={{
            width: "100%",
            background: accepting ? "#94a3b8" : "#0C4A6E",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "13px",
            fontSize: 14,
            fontWeight: 700,
            cursor: accepting ? "default" : "pointer",
          }}
        >
          {accepting ? "Joining..." : "Accept & join"}
        </button>
      )}
    </>
  );
}
