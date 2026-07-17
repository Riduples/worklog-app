"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { fmt } from "@/lib/format";
import type { LedgerEntry } from "@/lib/supabase/hooks/useLedger";

// The expense-side twin of InvoiceMatcher. Same job from the other end: an
// invoice counts revenue when issued, so the payment against it must not count
// again; a supplier ledger entry counts a cost when incurred, so the expense
// that settles it must not count again either.
//
// Simpler than the invoice case in one way — ledger entries carry no VAT
// breakdown, just an amount — so "does this settle it" is a plain comparison
// rather than the ex-VAT/incl-VAT juggling invoices need.

/**
 * What is still owed on an entry. Entries have no partial-payment arithmetic —
 * status carries 'partial' but no amount-paid column exists to subtract — so a
 * partial entry still shows its full amount and this stays honest about that
 * rather than inventing a number.
 */
export function ledgerEntryOutstanding(e: LedgerEntry): number {
  return e.status === "paid" ? 0 : Number(e.amount);
}

/**
 * Whether an expense settles a supplier entry outright. Shared by the modal
 * that writes status='paid' and the matcher that offers the checkbox, so the
 * two cannot drift. A cent short is still settled.
 */
export function expenseSettlesEntry(e: LedgerEntry | null | undefined, expenseAmount: number): boolean {
  if (!e || e.status === "paid" || expenseAmount <= 0) return false;
  return expenseAmount + 0.01 >= ledgerEntryOutstanding(e);
}

export function LedgerEntryMatcher({
  entries,
  matchedId,
  onMatch,
  filterByParty,
  onAutoFillParty,
  expenseAmount = 0,
  markPaid = false,
  onMarkPaidChange,
}: {
  /** Supplier entries only — a client entry is money owed TO the business. */
  entries: LedgerEntry[];
  matchedId: string | null;
  onMatch: (id: string | null) => void;
  filterByParty?: string;
  onAutoFillParty?: (party: string) => void;
  /** The expense being logged, used to see whether it settles the entry. */
  expenseAmount?: number;
  markPaid?: boolean;
  onMarkPaidChange?: (next: boolean) => void;
}) {
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");

  if (entries.length === 0) return null;

  const matched = entries.find((e) => e.id === matchedId) ?? null;
  const settles = expenseSettlesEntry(matched, expenseAmount);

  const named = (filterByParty ?? "").trim().toLowerCase();
  const isFor = (e: LedgerEntry) => (e.party_name ?? "").toLowerCase() === named;
  const partyEntries = named ? entries.filter(isFor) : [];
  const otherEntries = named ? entries.filter((e) => !isFor(e)) : entries;

  const bySearch = (list: LedgerEntry[]) =>
    list.filter((e) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (e.party_name ?? "").toLowerCase().includes(s) ||
        (e.note ?? "").toLowerCase().includes(s) ||
        String(e.amount).includes(s)
      );
    });

  const shownPartyEntries = bySearch(partyEntries);
  const shownOtherEntries = bySearch(otherEntries);

  const renderEntry = (e: LedgerEntry) => {
    const paid = e.status === "paid";
    return (
      <button
        key={e.id}
        onClick={() => {
          onMatch(e.id);
          if (onAutoFillParty && e.party_name) onAutoFillParty(e.party_name);
          setShow(false);
        }}
        style={{
          width: "100%",
          padding: "12px 14px",
          border: "none",
          borderBottom: "1px solid #f8fafc",
          background: matchedId === e.id ? "#F0F9FF" : "#fff",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13 }}>📕</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{e.party_name}</span>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {e.entry_date}
            {e.note ? ` · ${e.note}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E" }}>{fmt(Number(e.amount))}</div>
          {paid ? (
            <div style={{ fontSize: 11, color: "#0369A1", fontWeight: 600 }}>✓ Paid</div>
          ) : (
            <div style={{ fontSize: 11, color: "#b45309", fontWeight: 600 }}>You owe</div>
          )}
        </div>
      </button>
    );
  };

  const hint =
    named && partyEntries.length > 0
      ? `⚡ ${partyEntries.length} entr${partyEntries.length === 1 ? "y" : "ies"} for ${filterByParty} — tap to view`
      : "Tap to find a credit entry...";

  return (
    <Field label="Is this paying off something in your credit book? (optional)">
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
            border: `1.5px solid ${matched ? "#0C4A6E" : named && partyEntries.length > 0 ? "#F59E0B" : "#e2e8f0"}`,
            background: matched ? "#F0F9FF" : named && partyEntries.length > 0 ? "#fffbeb" : "#f8fafc",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, color: matched ? "#0C4A6E" : "#94a3b8", fontWeight: matched ? 700 : 400 }}>
            {matched ? `📕 ${matched.party_name} — ${fmt(Number(matched.amount))}` : hint}
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
                placeholder="Search by supplier, note or amount..."
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
              {shownPartyEntries.length === 0 && shownOtherEntries.length === 0 && (
                <div style={{ padding: "12px 14px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>No credit entries found</div>
              )}
              {shownPartyEntries.length > 0 && (
                <>
                  <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 700, color: "#b45309", textTransform: "uppercase", letterSpacing: 0.6, background: "#fffbeb" }}>
                    What you owe {filterByParty}
                  </div>
                  {shownPartyEntries.map(renderEntry)}
                </>
              )}
              {shownOtherEntries.length > 0 && (
                <>
                  <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, background: "#f8fafc" }}>
                    {named ? "Other credit entries" : "Your credit book"}
                  </div>
                  {shownOtherEntries.map(renderEntry)}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {matched && (
        <div style={{ marginTop: 6, padding: "7px 12px", background: "#F0F9FF", borderRadius: 8, fontSize: 11, color: "#0C4A6E", fontWeight: 600, lineHeight: 1.5 }}>
          {/* One template string, not JSX text: JSX eats the space between an
              expression and the text following it. */}
          {`✅ Linked to what you owe ${matched.party_name} — kept out of Profit & Loss so this cost isn't counted twice.`}
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
            {`This covers the full ${fmt(ledgerEntryOutstanding(matched))} — mark what you owe ${matched.party_name} as settled`}
          </span>
        </button>
      )}

      {/* A short payment links and nothing more. Entries have a 'partial' status
          but no amount-paid column, so writing 'partial' would record that
          something was paid without recording how much — and the next screen to
          read it would have to guess. Linking still keeps the cost out of the
          report, which is the part that matters. */}
      {matched && !settles && matched.status !== "paid" && expenseAmount > 0 && (
        <div style={{ marginTop: 6, padding: "7px 12px", background: "#fff7ed", borderRadius: 8, fontSize: 11, color: "#92400e", fontWeight: 600, lineHeight: 1.5 }}>
          {`Part payment — ${fmt(ledgerEntryOutstanding(matched) - expenseAmount)} of the ${fmt(ledgerEntryOutstanding(matched))} would still be owed, so this entry stays open.`}
        </div>
      )}
    </Field>
  );
}
