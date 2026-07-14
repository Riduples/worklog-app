"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { useCreateInvite } from "@/lib/supabase/hooks/useInvites";

export function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");
  const [error, setError] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createInvite = useCreateInvite();

  const handleSave = () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    createInvite.mutate(
      { email: email.trim(), role },
      {
        onSuccess: (invite) => {
          setLink(`${window.location.origin}/accept-invite?token=${invite.token}`);
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't create the invite."),
      }
    );
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — the link
      // is still shown in the box below for manual copy.
    }
  };

  if (link) {
    return (
      <Modal title="Invite created" onClose={onClose}>
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "#166534", lineHeight: 1.5 }}>
          Share this link with <strong>{email}</strong> — it lets them join as a <strong>{role}</strong>. It expires in
          7 days.
        </div>
        <div
          style={{
            background: "#f8fafc",
            border: "1.5px solid #e2e8f0",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 14,
            fontSize: 12,
            color: "#374151",
            wordBreak: "break-all",
          }}
        >
          {link}
        </div>
        <SaveBtn label={copied ? "Copied!" : "Copy link"} icon="📋" onClick={copyLink} />
        <button
          onClick={onClose}
          style={{ width: "100%", background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 10, padding: 6 }}
        >
          Done
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Invite a team member" onClose={onClose}>
      <Field label="Email">
        <Input value={email} onChange={setEmail} type="email" placeholder="name@example.com" autoFocus />
      </Field>

      <Field label="Role">
        <div style={{ display: "flex", gap: 8 }}>
          {(["member", "owner"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                border: `1.5px solid ${role === r ? "#1B4332" : "#e2e8f0"}`,
                background: role === r ? "#1B4332" : "#fff",
                color: role === r ? "#fff" : "#374151",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn
        label={createInvite.isPending ? "Creating..." : "Create invite link"}
        icon="✉️"
        onClick={handleSave}
        disabled={createInvite.isPending}
      />
    </Modal>
  );
}
