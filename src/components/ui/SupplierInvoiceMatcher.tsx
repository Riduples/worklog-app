"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { fmt } from "@/lib/format";
import { balanceInclVat } from "@/lib/balance";
import type { SupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";

// The supplier-invoice twin of LedgerEntryMatcher, and the purchase-side mirror
// of the customer InvoiceMatcher. A supplier invoice counts as a cost the moment
// it is issued, so the cash expense that pays it must not count again — this is
// where the payment names the invoice it settles, so Profit & Loss can leave it
// out. Unlike the ledger, supplier invoices carry a VAT breakdown and real
// partial-payment tracking, so outstanding is the incl-VAT balance still owed.

/** What is still owed on a supplier invoice, incl. VAT. balance_due goes to zero
 *  when paid while vat_amount stays, so this must go through balanceInclVat —
 *  adding the two by hand says a settled invoice still owes the VAT. */
export function supplierInvoiceOutstanding(si: SupplierInvoice): number {
  return balanceInclVat(si.balance_due, si.vat_amount);
}

/**
 * Whether an expense settles a supplier invoice outright. Shared by the modal
 * that writes status='paid' and the matcher that offers the checkbox, so the two
 * cannot drift. A cent short is still settled. The expense amount is the cash
 * paid (incl. VAT), so it compares against the incl-VAT balance.
 */
export function expenseSettlesSupplierInvoice(si: SupplierInvoice | null | undefined, expenseAmount: number): boolean {
  if (!si || si.status === "paid" || expenseAmount <= 0) return false;
  return expenseAmount + 0.01 >= supplierInvoiceOutstanding(si);
}

export function SupplierInvoiceMatcher({
  invoices,
  matchedId,
  onMatch,
  filterByParty,
  onAutoFillParty,
  expenseAmount = 0,
  markPaid = false,
  onMarkPaidChange,
}: {
  invoices: SupplierInvoice[];
  matchedId: string | null;
  onMatch: (id: string | null) => void;
  filterByParty?: string;
  onAutoFillParty?: (party: string) => void;
  /** The expense being logged, used to see whether it settles the invoice. */
  expenseAmount?: number;
  markPaid?: boolean;
  onMarkPaidChange?: (next: boolean) => void;
}) {
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");

  // Only ones you still owe on — a fully-paid bill has nothing left to settle,
  // and keeping the list to open bills is what stops it becoming noise.
  const open = invoices.filter((si) => si.status !== "paid");
  if (open.length === 0) return null;

  const matched = open.find((si) => si.id === matchedId) ?? null;
  const settles = expenseSettlesSupplierInvoice(matched, expenseAmount);

  const named = (filterByParty ?? "").trim().toLowerCase();
  const isFor = (si: SupplierInvoice) => (si.supplier_name ?? "").toLowerCase() === named;
  const partyInvoices = named ? open.filter(isFor) : [];
  const otherInvoices = named ? open.filter((si) => !isFor(si)) : open;

  const bySearch = (list: SupplierInvoice[]) =>
    list.filter((si) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (si.supplier_name ?? "").toLowerCase().includes(s) ||
        (si.supplier_ref_number ?? "").toLowerCase().includes(s) ||
        String(si.invoice_amount).includes(s)
      );
    });

  const shownPartyInvoices = bySearch(partyInvoices);
  const shownOtherInvoices = bySearch(otherInvoices);

  const renderInvoice = (si: SupplierInvoice) => (
    <button
      key={si.id}
      onClick={() => {
        onMatch(si.id);
        if (onAutoFillParty && si.supplier_name) onAutoFillParty(si.supplier_name);
        setShow(false);
      }}
      style={{
        width: "100%",
        padding: "12px 14px",
        border: "none",
        borderBottom: "1px solid #f8fafc",
        background: matchedId === si.id ? "#F0F9FF" : "#fff",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13 }}>📥</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{si.supplier_name}</span>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          {si.issue_date}
          {si.supplier_ref_number ? ` · ${si.supplier_ref_number}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E" }}>{fmt(supplierInvoiceOutstanding(si))}</div>
        <div style={{ fontSize: 11, color: "#b45309", fontWeight: 600 }}>You owe</div>
      </div>
    </button>
  );

  const hint =
    named && partyInvoices.length > 0
      ? `⚡ ${partyInvoices.length} bill${partyInvoices.length === 1 ? "" : "s"} from ${filterByParty} — tap to view`
      : "Tap to find a supplier invoice...";

  return (
    <Field label="Is this paying a supplier invoice? (optional)">
      <div style={{ position: "relative" }}>
        <button
          onClick={() => {
            setShow((p) => !p);
            setSearch("");
          }}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1.5px solid ${matched ? "#0C4A6E" : named && partyInvoices.length > 0 ? "#F59E0B" : "#e2e8f0"}`,
            background: matched ? "#F0F9FF" : named && partyInvoices.length > 0 ? "#fffbeb" : "#f8fafc",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, color: matched ? "#0C4A6E" : "#94a3b8", fontWeight: matched ? 700 : 400 }}>
            {matched ? `📥 ${matched.supplier_name} — ${fmt(supplierInvoiceOutstanding(matched))}` : hint}
          </span>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{show ? "▲" : "▼"}</span>
        </button>

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
                placeholder="Search by supplier, reference or amount..."
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {matchedId && (
                <button
                  onClick={() => {
                    onMatch(null);
                    setShow(false);
                  }}
                  style={{ width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid #f8fafc", background: "#fff7ed", cursor: "pointer", textAlign: "left", fontSize: 13, color: "#b45309", fontWeight: 600 }}
                >
                  ✕ Remove link
                </button>
              )}
              {shownPartyInvoices.length === 0 && shownOtherInvoices.length === 0 && (
                <div style={{ padding: "12px 14px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>No open supplier invoices found</div>
              )}
              {shownPartyInvoices.length > 0 && (
                <>
                  <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 700, color: "#b45309", textTransform: "uppercase", letterSpacing: 0.6, background: "#fffbeb" }}>
                    Bills from {filterByParty}
                  </div>
                  {shownPartyInvoices.map(renderInvoice)}
                </>
              )}
              {shownOtherInvoices.length > 0 && (
                <>
                  <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, background: "#f8fafc" }}>
                    {named ? "Other supplier invoices" : "Open supplier invoices"}
                  </div>
                  {shownOtherInvoices.map(renderInvoice)}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {matched && (
        <div style={{ marginTop: 6, padding: "7px 12px", background: "#F0F9FF", borderRadius: 8, fontSize: 11, color: "#0C4A6E", fontWeight: 600, lineHeight: 1.5 }}>
          {`✅ Linked to ${matched.supplier_name}'s invoice — kept out of Profit & Loss so this cost isn't counted twice.`}
        </div>
      )}

      {matched && settles && onMarkPaidChange && (
        <button
          onClick={() => onMarkPaidChange(!markPaid)}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "9px 12px",
            borderRadius: 8,
            border: `1.5px solid ${markPaid ? "#0C4A6E" : "#BAE6FD"}`,
            background: markPaid ? "#F0F9FF" : "#fff",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14, color: markPaid ? "#0C4A6E" : "#cbd5e1" }}>{markPaid ? "☑" : "☐"}</span>
          <span style={{ fontSize: 11, color: "#0369A1", fontWeight: 700, lineHeight: 1.5 }}>
            {`This covers the full ${fmt(supplierInvoiceOutstanding(matched))} — mark ${matched.supplier_name}'s invoice as paid`}
          </span>
        </button>
      )}

      {/* A short payment links the cost so P&L stays right, but leaves the invoice
          open — the balance still owed is real and belongs in what you owe. */}
      {matched && !settles && expenseAmount > 0 && (
        <div style={{ marginTop: 6, padding: "7px 12px", background: "#fff7ed", borderRadius: 8, fontSize: 11, color: "#92400e", fontWeight: 600, lineHeight: 1.5 }}>
          {`Part payment — ${fmt(supplierInvoiceOutstanding(matched) - expenseAmount)} of the ${fmt(supplierInvoiceOutstanding(matched))} would still be owed, so this invoice stays open.`}
        </div>
      )}
    </Field>
  );
}
