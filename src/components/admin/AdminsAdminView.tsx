"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { AdminNav } from "@/components/admin/AdminNav";
import { Input } from "@/components/ui/Input";
import { useAdminAdmins } from "@/lib/supabase/hooks/useAdminData";

export function AdminsAdminView({ currentUserId }: { currentUserId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: admins } = useAdminAdmins();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-admins"] });
    qc.invalidateQueries({ queryKey: ["is-platform-admin"] });
  };

  const add = async () => {
    setError(""); setDone(""); setBusy(true);
    const { error } = await supabase.rpc("admin_add_admin", { p_email: email.trim() });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(`${email.trim()} is now an admin.`);
    setEmail("");
    refresh();
  };

  const remove = async (userId: string, label: string) => {
    setError(""); setDone(""); setBusy(true);
    const { error } = await supabase.rpc("admin_remove_admin", { p_user_id: userId });
    setBusy(false);
    if (error) { setError(error.message); return; }
    // Removing yourself revokes your own access — leave the console rather than
    // sit on a now-forbidden page whose refetch would just error.
    if (userId === currentUserId) { router.push("/dashboard"); return; }
    setDone(`Removed ${label}.`);
    refresh();
  };

  const list = admins ?? [];

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 640, margin: "0 auto" }}>
      <AdminNav active="admins" />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 6 }}>Platform admins</h1>
      <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6, marginBottom: 16 }}>
        Who can reach this console and edit platform-wide data (SARS rates, announcements, subscriptions). The person must
        already have a Worklog account. You can&apos;t remove the last admin.
      </p>

      <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>Add an admin</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><Input value={email} onChange={setEmail} type="email" placeholder="their@email.co.za" /></div>
          <button onClick={add} disabled={busy || !email.trim()} style={{ flexShrink: 0, background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 10, padding: "0 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Add
          </button>
        </div>
        {error && <p style={{ color: "#dc2626", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
        {done && <p style={{ color: "#166534", fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>✅ {done}</p>}
      </div>

      {list.map((a) => (
        <div key={a.user_id} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0C4A6E" }}>{a.email ?? a.user_id}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{a.note ?? "admin"} · since {a.created_at.slice(0, 10)}</div>
          </div>
          <button
            onClick={() => remove(a.user_id, a.email ?? "admin")}
            disabled={busy || list.length <= 1}
            style={{ flexShrink: 0, background: "#fff", border: "1.5px solid #fecaca", color: list.length <= 1 ? "#cbd5e1" : "#b91c1c", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: list.length <= 1 ? "not-allowed" : "pointer" }}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
