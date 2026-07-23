"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { AdminNav } from "@/components/admin/AdminNav";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import type { Tables } from "@/lib/types/database";

type Announcement = Tables<"announcements">;

type Draft = {
  id?: string;
  message: string;
  level: string;
  link_url: string;
  link_label: string;
  active: boolean;
  dismissible: boolean;
  starts_at: string;
  ends_at: string;
};

const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string): string | null => (v.trim() ? new Date(v).toISOString() : null);

const rowToDraft = (a: Announcement): Draft => ({
  id: a.id,
  message: a.message,
  level: a.level,
  link_url: a.link_url ?? "",
  link_label: a.link_label ?? "",
  active: a.active,
  dismissible: a.dismissible,
  starts_at: toLocalInput(a.starts_at),
  ends_at: toLocalInput(a.ends_at),
});
const newDraft = (): Draft => ({ message: "", level: "info", link_url: "", link_label: "", active: true, dismissible: true, starts_at: "", ends_at: "" });

function liveState(a: Announcement): { label: string; color: string } {
  if (!a.active) return { label: "Off", color: "#94a3b8" };
  const now = Date.now();
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return { label: "Scheduled", color: "#0369A1" };
  if (a.ends_at && new Date(a.ends_at).getTime() < now) return { label: "Expired", color: "#b45309" };
  return { label: "Live", color: "#166534" };
}

export function AnnouncementsAdminView() {
  const supabase = createClient();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);

  const { data: rows } = useQuery({
    queryKey: ["announcements-admin"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["announcements-admin"] });
    qc.invalidateQueries({ queryKey: ["active-announcement"] });
  };

  const toggleActive = async (a: Announcement) => {
    await supabase.from("announcements").update({ active: !a.active }).eq("id", a.id);
    refresh();
  };
  const remove = async (a: Announcement) => {
    await supabase.from("announcements").delete().eq("id", a.id);
    refresh();
  };

  const list = rows ?? [];

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 760, margin: "0 auto" }}>
      <AdminNav active="announcements" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E" }}>Announcements</h1>
        <button onClick={() => setEditing(newDraft())} style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + New
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6, marginBottom: 16 }}>
        A banner shown to every user across the app. Only the most recent LIVE one appears; users can dismiss a dismissible one
        (it reappears when you post a new one).
      </p>

      {list.length === 0 && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
          No announcements yet.
        </div>
      )}

      {list.map((a) => {
        const st = liveState(a);
        return (
          <div key={a.id} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "13px 16px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: st.color, border: `1.5px solid ${st.color}`, borderRadius: 8, padding: "1px 7px" }}>{st.label}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{a.level}</span>
                </div>
                <div style={{ fontSize: 13, color: "#111", lineHeight: 1.5 }}>{a.message}</div>
                {(a.starts_at || a.ends_at) && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                    {a.starts_at ? `from ${new Date(a.starts_at).toLocaleString("en-ZA")}` : ""}
                    {a.ends_at ? ` until ${new Date(a.ends_at).toLocaleString("en-ZA")}` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button onClick={() => toggleActive(a)} style={{ background: a.active ? "#fff7ed" : "#f0fdf4", border: `1.5px solid ${a.active ? "#fed7aa" : "#bbf7d0"}`, color: a.active ? "#b45309" : "#166534", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  {a.active ? "Turn off" : "Turn on"}
                </button>
                <button onClick={() => setEditing(rowToDraft(a))} style={{ background: "#f0f9ff", border: "1.5px solid #bfdbfe", color: "#1e40af", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  Edit
                </button>
                <button onClick={() => remove(a)} style={{ background: "#fff", border: "1.5px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {editing && (
        <AnnouncementEditor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AnnouncementEditor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof Draft, v: string | boolean) => setD((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setError("");
    if (!d.message.trim()) {
      setError("A message is required.");
      return;
    }
    const link = d.link_url.trim();
    const relativeOk = link.startsWith("/") && !link.startsWith("//") && !link.startsWith("/\\");
    if (link && !(relativeOk || /^https?:\/\//i.test(link))) {
      setError("The link must be a single-slash relative path (e.g. /pricing) or an http(s) URL.");
      return;
    }
    const startsIso = fromLocalInput(d.starts_at);
    const endsIso = fromLocalInput(d.ends_at);
    if (startsIso && endsIso && endsIso <= startsIso) {
      setError("The end time must be after the start time.");
      return;
    }
    const payload = {
      message: d.message.trim(),
      level: d.level,
      link_url: d.link_url.trim() || null,
      link_label: d.link_label.trim() || null,
      active: d.active,
      dismissible: d.dismissible,
      starts_at: startsIso,
      ends_at: endsIso,
    };
    setSaving(true);
    const { error } = d.id
      ? await supabase.from("announcements").update(payload).eq("id", d.id)
      : await supabase.from("announcements").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  };

  return (
    <Modal title={d.id ? "Edit announcement" : "New announcement"} onClose={onClose}>
      <Field label="Message">
        <textarea
          value={d.message}
          onChange={(e) => set("message", e.target.value)}
          rows={3}
          placeholder="e.g. Scheduled maintenance this Sunday 02:00–03:00. The app may be briefly unavailable."
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
        />
      </Field>
      <Field label="Style">
        <Chips options={["info", "warning", "success"]} selected={d.level} onSelect={(v) => v && set("level", v)} />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Link URL (optional)">
            <Input value={d.link_url} onChange={(v) => set("link_url", v)} placeholder="/pricing or https://…" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Link label">
            <Input value={d.link_label} onChange={(v) => set("link_label", v)} placeholder="Learn more" />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Show from (optional)">
            <Input value={d.starts_at} onChange={(v) => set("starts_at", v)} type="datetime-local" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Hide after (optional)">
            <Input value={d.ends_at} onChange={(v) => set("ends_at", v)} type="datetime-local" />
          </Field>
        </div>
      </div>

      <Toggle label="Active (show it now)" on={d.active} onToggle={() => set("active", !d.active)} />
      <Toggle label="Users can dismiss it" on={d.dismissible} onToggle={() => set("dismissible", !d.dismissible)} />

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 10, marginBottom: 8 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save announcement"} icon="💾" onClick={handleSave} disabled={saving} allowInReadOnly />
    </Modal>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ width: "100%", textAlign: "left", padding: "11px 14px", borderRadius: 12, border: `1.5px solid ${on ? "#0C4A6E" : "#e2e8f0"}`, background: on ? "#F0F9FF" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}
    >
      <span style={{ fontSize: 18 }}>{on ? "✅" : "⬜"}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: on ? "#0C4A6E" : "#111" }}>{label}</span>
    </button>
  );
}
