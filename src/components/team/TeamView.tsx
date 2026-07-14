"use client";

import { useState } from "react";
import Link from "next/link";
import { useBusinessMembers, useUpdateMemberPermissions } from "@/lib/supabase/hooks/useBusinessMembers";
import { usePendingInvites, useRevokeInvite } from "@/lib/supabase/hooks/useInvites";
import { useBusinessProfile, useUpdateBusinessPlan } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { InviteModal } from "@/components/modals/InviteModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { PermissionsEditor } from "@/components/team/PermissionsEditor";
import { TIERS, isLocked, type Plan } from "@/lib/tiers";
import type { Permissions } from "@/lib/permissions";

export function TeamView() {
  const { data: business } = useBusinessProfile();
  const { data: currentMember } = useCurrentMember();
  const { data: members, isLoading: membersLoading } = useBusinessMembers();
  const { data: invites, isLoading: invitesLoading } = usePendingInvites();
  const revokeInvite = useRevokeInvite();
  const updatePlan = useUpdateBusinessPlan();
  const updateMemberPermissions = useUpdateMemberPermissions();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [permissionsFor, setPermissionsFor] = useState<{ id: string; email: string; permissions: Permissions } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isOwner = currentMember?.role === "owner";
  const plan = (business?.plan ?? "shoebox") as Plan;
  const teamLocked = isLocked(plan, "team");

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

  const handleInviteClick = () => {
    if (teamLocked) setUpgradeOpen(true);
    else setInviteOpen(true);
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
          onClick={handleInviteClick}
          style={{ background: "#1B4332", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          {teamLocked ? "🔒 Invite" : "+ Invite"}
        </button>
      </div>

      {isOwner && business && (
        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              WORKLOG {TIERS[plan].label} · {TIERS[plan].price}
            </div>
            <div style={{ fontSize: 11, color: "#7DD3FC", marginTop: 2 }}>
              {(members ?? []).length} user{(members ?? []).length !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(Object.keys(TIERS) as Plan[]).map((p) => (
              <button
                key={p}
                onClick={() => p !== plan && updatePlan.mutate({ businessId: business.id, plan: p })}
                disabled={updatePlan.isPending}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1.5px solid ${p === plan ? "#7DD3FC" : "rgba(255,255,255,0.3)"}`,
                  background: p === plan ? "#7DD3FC" : "transparent",
                  color: p === plan ? "#0C4A6E" : "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: updatePlan.isPending ? "default" : "pointer",
                }}
              >
                {TIERS[p].label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        Members
      </div>
      {membersLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {(members ?? []).map((m) => (
        <div
          key={m.id}
          style={{ background: "#fff", borderRadius: 13, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{m.email}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isOwner && m.role !== "owner" && (
              <button
                onClick={() => setPermissionsFor({ id: m.id, email: m.email, permissions: m.permissions ?? {} })}
                style={{ background: "#f0f9ff", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#1e40af", cursor: "pointer" }}
              >
                Permissions
              </button>
            )}
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
              <div key={inv.id} style={{ background: "#fff", borderRadius: 13, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
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
                    style={{ width: "100%", background: "#f0fdf4", border: "1.5px solid #d1fae5", borderRadius: 10, padding: 8, fontSize: 12, fontWeight: 700, color: "#166534", cursor: "pointer" }}
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
      {upgradeOpen && business && (
        <UpgradeModal feature="team" currentPlan={plan} businessId={business.id} isOwner={isOwner} onClose={() => setUpgradeOpen(false)} />
      )}
      {permissionsFor && (
        <PermissionsEditor
          memberName={permissionsFor.email}
          initialPermissions={permissionsFor.permissions}
          onBack={() => setPermissionsFor(null)}
          onSave={(perms) =>
            updateMemberPermissions.mutate(
              { memberId: permissionsFor.id, permissions: perms },
              { onSuccess: () => setPermissionsFor(null) }
            )
          }
        />
      )}
    </div>
  );
}
