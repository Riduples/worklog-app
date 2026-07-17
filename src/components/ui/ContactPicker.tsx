"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { Contact } from "@/lib/supabase/hooks/useContacts";

export function ContactPicker({
  label,
  value,
  onChange,
  contacts,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string, contactId: string | null) => void;
  contacts: Contact[];
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = contacts.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Field label={label}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Input value={value} onChange={(v) => onChange(v, null)} placeholder={placeholder} />
          </div>
          {contacts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShow((p) => !p);
                setSearch("");
              }}
              style={{
                background: show ? "#0C4A6E" : "#F0F9FF",
                border: "1.5px solid #BAE6FD",
                borderRadius: 10,
                padding: "12px 12px",
                fontSize: 13,
                fontWeight: 700,
                color: show ? "#fff" : "#0C4A6E",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {show ? "✕" : "👤 List"}
            </button>
          )}
        </div>
        {show && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 60,
              background: "#fff",
              border: "1.5px solid #BAE6FD",
              borderRadius: 12,
              marginTop: 4,
              boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filtered.length === 0 && (
                <div style={{ padding: "12px 14px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                  No contacts found
                </div>
              )}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.name, c.id);
                    setShow(false);
                    setSearch("");
                  }}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "none",
                    borderBottom: "1px solid #f8fafc",
                    background: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{c.name}</div>
                    {c.phone && <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.phone}</div>}
                  </div>
                  {c.contact_type === "client" && c.payment_behaviour ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 20,
                        flexShrink: 0,
                        marginLeft: 8,
                        background:
                          c.payment_behaviour === "Good payer"
                            ? "#BAE6FD"
                            : c.payment_behaviour === "Slow payer"
                              ? "#fef9c3"
                              : "#fee2e2",
                        color:
                          c.payment_behaviour === "Good payer"
                            ? "#0369A1"
                            : c.payment_behaviour === "Slow payer"
                              ? "#854d0e"
                              : "#991b1b",
                      }}
                    >
                      {c.payment_behaviour}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 20,
                        background: "#e0f2fe",
                        color: "#0369a1",
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    >
                      Supplier
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}
