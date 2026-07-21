"use client";

import { useState } from "react";
import Link from "next/link";
import { useBusinessMembers, useUpdateMemberPermissions } from "@/lib/supabase/hooks/useBusinessMembers";
import { usePendingInvites, useRevokeInvite } from "@/lib/supabase/hooks/useInvites";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { InviteModal } from "@/components/modals/InviteModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { PermissionsEditor } from "@/components/team/PermissionsEditor";
import { TIERS, isLocked, entitlementsFor, type Plan } from "@/lib/tiers";
import type { Permissions } from "@/lib/permissions";
import { BackLink } from "@/components/ui/BackLink";

export function TeamView() {
  const { data: business } = useBusinessProfile();
  const { data: currentMember } = useCurrentMember();
  const { data: members, isLoading: membersLoading } = useBusinessMembers();
  const { data: invites, isLoading: invitesLoading } = usePendingInvites();
  const revokeInvite = useRevokeInvite();
  const updateMemberPermissions = useUpdateMemberPermissions();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [permissionsFor, setPermissionsFor] = useState<{ id: string; email: string; permissions: Permissions } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isOwner = currentMember?.role === "owner";
  const plan = (business?.plan ?? "solo") as Plan;
  const teamLocked = isLocked(plan, "team");
  // The 5-login cap on Trade counts owner + accepted members + still-live invites
  // (a pending invite is a seat already spoken for). null = unlimited (Structured).
  const maxMembers = entitlementsFor(plan).maxMembers;
  const activeInvites = (invites ?? []).filter((i) => new Date(i.expires_at) >= new Date()).length;
  const usedSeats = (members?.length ?? 0) + activeInvites;
  const seatsFull = maxMembers !== null && usedSeats >= maxMembers;

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
    if (teamLocked || seatsFull) setUpgradeOpen(true);
    else setInviteOpen(true);
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Team</h1>
        </div>
        <button
          onClick={handleInviteClick}
          style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          {teamLocked ? "🔒 Invite" : "+ Invite"}
        </button>
      </div>

      {isOwner && business && (
        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              Worklog {TIERS[plan].label} · {TIERS[plan].price}
            </div>
            <div style={{ fontSize: 11, color: "#7DD3FC", marginTop: 2 }}>
              {maxMembers === null
                ? `${(members ?? []).length} user${(members ?? []).length !== 1 ? "s" : ""} · unlimited logins`
                : `${usedSeats} of ${maxMembers} logins used`}
            </div>
          </div>
          {/* A plan change goes through checkout, which respects the payment
              lock (0054) — an upgrade needs a verified payment, and even a
              downgrade is a deliberate act on its own page. This was three pills
              that called update_business_plan directly: left over from before
              the checkout flow existed, and a live foot-gun. One click on the
              tier you weren't on silently changed your plan with no confirmation
              — a downgrade went straight through (owners may downgrade), which
              is exactly how a director exploring this page dropped herself to
              the entry tier mid-test. */}
          <Link
            href="/billing/checkout"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1.5px solid #7DD3FC",
              background: "#7DD3FC",
              color: "#0C4A6E",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Change plan
          </Link>
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
                background: m.role === "owner" ? "#fff7ed" : "#F0F9FF",
                color: m.role === "owner" ? "#92400e" : "#0369A1",
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
                    style={{ width: "100%", background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10, padding: 8, fontSize: 12, fontWeight: 700, color: "#0369A1", cursor: "pointer" }}
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
        <UpgradeModal feature="team" currentPlan={plan} isOwner={isOwner} onClose={() => setUpgradeOpen(false)} />
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
