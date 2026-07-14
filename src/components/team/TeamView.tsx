"use client";

import { useState } from "react";
import Link from "next/link";
import { useBusinessMembers } from "@/lib/supabase/hooks/useBusinessMembers";
import { usePendingInvites, useRevokeInvite } from "@/lib/supabase/hooks/useInvites";
import { InviteModal } from "@/components/modals/InviteModal";

export function TeamView() {
  const { data: members, isLoading: membersLoading } = useBusinessMembers();
  const { data: invites, isLoading: invitesLoading } = usePendingInvites();
  const revokeInvite = useRevokeInvite();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyInviteLink = async (token: string, id: string) => {
    const link = `${window.location.origin}/accept-invite?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore — clipboard API can be unavailable in some contexts
    }
  };

  const handleRevoke = (id: string) => {
    if (!confirm("Revoke this invite? The link will stop working.")) return;
    revokeInvite.mutate(id);
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Team</h1>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          style={{
            background: "#1B4332",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Invite
        </button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        Members
      </div>
      {membersLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {(members ?? []).map((m) => (
        <div
          key={m.id}
          style={{
            background: "#fff",
            borderRadius: 13,
            padding: "12px 14px",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{m.email}</div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 20,
              textTransform: "capitalize",
              background: m.role === "owner" ? "#fff7ed" : "#f0fdf4",
              color: m.role === "owner" ? "#92400e" : "#166534",
            }}
          >
            {m.role}
          </span>
        </div>
      ))}

      {(invites ?? []).length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "20px 0 10px" }}>
            Pending invites
          </div>
          {invitesLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
          {(invites ?? []).map((inv) => {
            const expired = new Date(inv.expires_at) < new Date();
            return (
              <div
                key={inv.id}
                style={{
                  background: "#fff",
                  borderRadius: 13,
                  padding: "12px 14px",
                  marginBottom: 8,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{inv.email}</div>
                    <div style={{ fontSize: 11, color: expired ? "#be123c" : "#94a3b8" }}>
                      {expired ? "Expired" : `Invited as ${inv.role}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
                    aria-label="Revoke invite"
                  >
                    ✕
                  </button>
                </div>
                {!expired && (
                  <button
                    onClick={() => copyInviteLink(inv.token, inv.id)}
                    style={{
                      width: "100%",
                      background: "#f0fdf4",
                      border: "1.5px solid #d1fae5",
                      borderRadius: 10,
                      padding: "8px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#166534",
                      cursor: "pointer",
                    }}
                  >
                    {copiedId === inv.id ? "Copied!" : "📋 Copy invite link"}
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  );
}
