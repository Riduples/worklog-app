"use client";

import { useState } from "react";
import { useContacts, useUpdateContact, type Contact } from "@/lib/supabase/hooks/useContacts";
import { ContactModal } from "@/components/modals/ContactModal";
import { CSVImportModal } from "@/components/modals/CSVImportModal";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

export function ContactsView() {
  const { data: contacts, isLoading } = useContacts();
  const updateContact = useUpdateContact();
  // Contacts is one table but two tools: RLS picks clients/suppliers per row
  // via contact_type. The UI can't be that precise on a mixed list, so the
  // controls follow whichever side the user has rights to and RLS still has
  // the final say per row.
  const clientAccess = useToolAccess("clients");
  const supplierAccess = useToolAccess("suppliers");
  const [typeFilter, setTypeFilter] = useState<"all" | "client" | "supplier">("all");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [modalState, setModalState] = useState<{ open: boolean; contact?: Contact; defaultType?: "client" | "supplier" }>({
    open: false,
  });

  const importType = typeFilter === "supplier" ? "supplier" : "client";

  // "Can I add anything here?" — the add button targets the filtered type, so
  // follow that; on the "all" tab either right is enough to justify showing it.
  const addAccess = typeFilter === "supplier" ? supplierAccess : clientAccess;
  const canAddAny = typeFilter === "all" ? clientAccess.canEdit || supplierAccess.canEdit : addAccess.canEdit;
  const canDeleteContact = (c: Contact) => (c.contact_type === "supplier" ? supplierAccess : clientAccess).canDelete;
  const accessLoading = clientAccess.loading || supplierAccess.loading;

  const filtered = (contacts ?? []).filter((c) => {
    if (typeFilter !== "all" && c.contact_type !== typeFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this contact? It stays on any existing quotes/invoices.")) return;
    updateContact.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Contacts</h1>
        </div>
        {canAddAny && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setImportOpen(true)}
            style={{
              background: "#F0F9FF",
              color: "#0369A1",
              border: "1.5px solid #BAE6FD",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⬆ Import
          </button>
          <button
            onClick={() => setModalState({ open: true })}
            style={{
              background: "#0C4A6E",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Add
          </button>
        </div>
        )}
      </div>

      {!accessLoading && !canAddAny && <ReadOnlyNotice level={clientAccess.level} what="contacts" />}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search contacts..."
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1.5px solid #e2e8f0",
          fontSize: 14,
          boxSizing: "border-box",
          marginBottom: 12,
          background: "#fff",
        }}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "client", "supplier"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              padding: "8px 14px",
              borderRadius: 20,
              border: `1.5px solid ${typeFilter === t ? "#0C4A6E" : "#e2e8f0"}`,
              background: typeFilter === t ? "#0C4A6E" : "#fff",
              color: typeFilter === t ? "#fff" : "#374151",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t === "all" ? "All" : t === "client" ? "Clients" : "Suppliers"}
          </button>
        ))}
      </div>

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No contacts yet.</p>
      )}

      {filtered.map((c) => (
        <div
          key={c.id}
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
          <button
            onClick={() => setModalState({ open: true, contact: c })}
            style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", flex: 1, padding: 0 }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {c.contact_type === "client" ? c.payment_behaviour : c.payment_terms}
              {c.phone ? ` · ${c.phone}` : ""}
            </div>
          </button>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 20,
              marginRight: 8,
              background: c.contact_type === "client" ? "#F0F9FF" : "#fff7ed",
              color: c.contact_type === "client" ? "#0369A1" : "#92400e",
            }}
          >
            {c.contact_type === "client" ? "Client" : "Supplier"}
          </span>
          {canDeleteContact(c) && (
          <button
            onClick={() => handleSoftDelete(c.id)}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
            aria-label="Remove contact"
          >
            ✕
          </button>
          )}
        </div>
      ))}

      {modalState.open && (
        <ContactModal
          contact={modalState.contact}
          defaultType={modalState.defaultType}
          onClose={() => setModalState({ open: false })}
        />
      )}
      {importOpen && <CSVImportModal type={importType} onClose={() => setImportOpen(false)} />}
    </div>
  );
}
