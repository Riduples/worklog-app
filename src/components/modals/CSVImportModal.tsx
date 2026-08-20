"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Modal } from "@/components/ui/Modal";
import { SaveBtn } from "@/components/ui/SaveBtn";
import {
  CSV_TEMPLATES,
  buildTemplateCsv,
  parseCsvNumber,
  PAYMENT_BEHAVIOURS,
  PAYMENT_TERMS,
  CSV_EMPLOYMENT_TYPE_HINT,
  CSV_PAY_TYPE_HINT,
  type CsvImportType,
} from "@/lib/csvTemplates";
import { useCsvImport, fetchExistingNames } from "@/lib/supabase/hooks/useCsvImport";
import { normaliseItemType, ITEM_TYPE_META } from "@/lib/itemTypes";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_META, normaliseAccountType } from "@/lib/accountTypes";
import { findSarsCategory } from "@/lib/sarsCategories";
import { parseStaffCsvRow, type StaffCsvRow } from "@/lib/staffCsv";
import type { TablesInsert } from "@/lib/types/database";

type StockRow = Omit<TablesInsert<"stock_items">, "user_id" | "business_id">;
type ContactRow = Omit<TablesInsert<"contacts">, "user_id" | "business_id">;
type AccountRow = Omit<TablesInsert<"bank_accounts">, "user_id" | "business_id">;
type BankingIncomeRow = Omit<TablesInsert<"income">, "user_id" | "business_id">;
type BankingExpenseRow = Omit<TablesInsert<"expenses">, "user_id" | "business_id">;
/** A parsed statement line, tagged with which table it belongs in. */
type BankingRow = { dir: "in"; row: BankingIncomeRow } | { dir: "out"; row: BankingExpenseRow };
type ParsedRow = {
  row: StockRow | ContactRow | AccountRow | StaffCsvRow | BankingRow;
  name: string;
  issues: string[];
  duplicate: boolean;
};

// SA/continental-tolerant number parsing (currency marks, space/comma thousands,
// comma-or-dot decimal), shared with the staff importer so "R120", "1 200,00" and
// "8.500,00" all import right instead of truncating at the first non-digit.
const num = (v: unknown) => parseCsvNumber(v);

/**
 * `slotsLeft` is for a tool whose plan caps how many rows may exist — the Staff
 * Register on Solo. The database checks the cap per inserted row against the
 * count it can see, and every row of one batch sees the same count, so a bulk
 * insert would sail past a limit that stops the Add form dead. The import holds
 * the line itself: only that many rows go, and the screen says which ones didn't.
 */
export function CSVImportModal({ type, slotsLeft, onClose }: { type: CsvImportType; slotsLeft?: number; onClose: () => void }) {
  const template = CSV_TEMPLATES[type];
  const requiredCol = template.columns.find((c) => c.required)?.csvHeader ?? "name";
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  const csvImport = useCsvImport();

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv(type)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = template.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFile = async (file: File) => {
    setParseError("");
    const existing = await fetchExistingNames(type);
    const seenInFile = new Set<string>();

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        const rows: ParsedRow[] = [];
        for (const raw of results.data) {
          // Staff has its own parser: the mapping onto the register (three rate
          // columns behind one "rate", is_contractor, date of birth from the ID)
          // is enough work to be worth testing on its own.
          if (type === "staff") {
            const parsedStaff = parseStaffCsvRow(raw);
            if (!parsedStaff) continue;
            const staffKey = parsedStaff.name.toLowerCase();
            const dup = existing.has(staffKey) || seenInFile.has(staffKey);
            seenInFile.add(staffKey);
            rows.push({ row: parsedStaff.row, name: parsedStaff.name, issues: parsedStaff.issues, duplicate: dup });
            continue;
          }

          // A transaction has no name to be identified by — its identity is when
          // it happened, for how much, and what the statement called it. So it
          // parses ahead of the shared name logic and dedupes on its own key.
          if (type === "banking") {
            const date = (raw.date ?? "").trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue; // no usable date, no row
            const rawAmount = num(raw.amount);
            const desc = (raw.description ?? "").trim();
            const party = (raw.party ?? "").trim();
            const issues: string[] = [];

            // Direction: an explicit type column wins, otherwise the sign does —
            // which is how every exported statement already says it.
            const typed = (raw.type ?? "").trim().toLowerCase();
            const dir: "in" | "out" = /^(in|income|credit|cr|deposit|received)$/.test(typed)
              ? "in"
              : /^(out|expense|debit|dr|payment|paid)$/.test(typed)
                ? "out"
                : rawAmount < 0
                  ? "out"
                  : "in";
            if (typed && !/^(in|income|credit|cr|deposit|received|out|expense|debit|dr|payment|paid)$/.test(typed)) {
              issues.push(`type "${typed}" not recognised — read as money ${dir} from the amount`);
            }
            const amount = Math.abs(rawAmount);
            if (amount === 0) issues.push("amount is zero — check the file");

            // A category only sticks if it resolves to a real SARS heading;
            // free text would import as a category nobody can find again.
            const rawCat = (raw.category ?? "").trim();
            const cat = rawCat ? findSarsCategory(rawCat) : null;
            if (rawCat && !cat) issues.push(`category "${rawCat}" not recognised — will need a home after import`);

            const label = [date, party || desc || `R${amount.toFixed(2)}`].filter(Boolean).join(" · ");
            const key = `${date}|${amount.toFixed(2)}|${(party || desc).toLowerCase()}`;
            const duplicate = existing.has(key) || seenInFile.has(key);
            seenInFile.add(key);

            const shared = {
              amount,
              transaction_date: date,
              details: [desc, (raw.reference ?? "").trim()].filter(Boolean).join(" · ") || null,
              what_for: desc || null,
              sars_category: cat?.sars ?? null,
              source: "csv_import",
            };
            const bankingRow: BankingRow =
              dir === "in"
                ? { dir, row: { ...shared, received_from: party || null } }
                : { dir, row: { ...shared, paid_to: party || null } };
            rows.push({ row: bankingRow, name: label, issues, duplicate });
            continue;
          }

          // Stock templates ship a "description" column now; older files (and
          // contacts) still use "name". Accept either, name wins as fallback.
          const name = ((type === "stock" ? raw.description ?? raw.name : raw.name) ?? "").trim();
          if (!name) continue; // skip blank-name rows entirely
          const key = name.toLowerCase();
          const issues: string[] = [];
          const duplicate = existing.has(key) || seenInFile.has(key);
          seenInFile.add(key);

          let row: StockRow | ContactRow | AccountRow;
          if (type === "account") {
            const rawType = (raw.type ?? "").trim();
            if (rawType && normaliseAccountType(rawType) === "bank" && !/^(bank|cheque|current|transmission)$/i.test(rawType)) {
              issues.push(`type "${rawType}" not recognised — will be imported as Bank`);
            }
            const openingDate = (raw.opening_balance_date ?? "").trim();
            if (openingDate && !/^\d{4}-\d{2}-\d{2}$/.test(openingDate)) {
              issues.push(`opening_balance_date "${openingDate}" isn't YYYY-MM-DD — will be left blank`);
            }
            row = {
              name,
              account_type: normaliseAccountType(rawType),
              bank_name: (raw.bank_name ?? "").trim() || null,
              account_number: (raw.account_number ?? "").trim() || null,
              opening_balance: num(raw.opening_balance),
              opening_balance_date: /^\d{4}-\d{2}-\d{2}$/.test(openingDate) ? openingDate : null,
            };
          } else if (type === "stock") {
            const cost = num(raw.cost_price);
            const sell = num(raw.sell_price);
            const itemType = normaliseItemType(raw.item_type);
            // Match the manual form: only products & materials carry a stock
            // count, so services/labour/packages import with qty & reorder 0.
            const tracksStock = ITEM_TYPE_META[itemType].showStock;
            row = {
              name,
              item_type: itemType,
              qty: tracksStock ? Math.round(num(raw.qty)) : 0,
              cost_price: cost,
              sell_price: sell,
              reorder_level: tracksStock ? Math.round(num(raw.reorder_level)) : 0,
              margin_pct: sell > 0 ? ((sell - cost) / sell) * 100 : 0,
            };
          } else {
            const behaviour = (raw.payment_behaviour ?? "").trim();
            const terms = (raw.payment_terms ?? "").trim();
            if (type === "client" && behaviour && !PAYMENT_BEHAVIOURS.includes(behaviour)) {
              issues.push(`payment_behaviour "${behaviour}" not recognised — will be left blank`);
            }
            if (type === "supplier" && terms && !PAYMENT_TERMS.includes(terms)) {
              issues.push(`payment_terms "${terms}" not recognised — will be left blank`);
            }
            row = {
              contact_type: type,
              name,
              phone: (raw.phone ?? "").trim() || null,
              email: (raw.email ?? "").trim() || null,
              address: (raw.address ?? "").trim() || null,
              notes: (raw.notes ?? "").trim() || null,
              payment_behaviour: type === "client" && PAYMENT_BEHAVIOURS.includes(behaviour) ? behaviour : null,
              payment_terms: type === "supplier" && PAYMENT_TERMS.includes(terms) ? terms : null,
              bank_name: type === "supplier" ? (raw.bank_name ?? "").trim() || null : null,
              account_number: type === "supplier" ? (raw.account_number ?? "").trim() || null : null,
              custom_label: type === "client" ? (raw.custom_label ?? "").trim() || null : null,
              custom_value: type === "client" ? (raw.custom_value ?? "").trim() || null : null,
            };
          }
          rows.push({ row, name, issues, duplicate });
        }

        if (rows.length === 0) {
          setParseError(`No valid rows found. Make sure the file has a '${requiredCol}' column with values.`);
          return;
        }
        setParsed(rows);
        setStep("preview");
      },
      error: (err) => setParseError(`Couldn't read the file: ${err.message}`),
    });
  };

  const importable = parsed.filter((p) => !p.duplicate);
  // Rows past the plan's cap. They stay visible in the preview, marked, rather
  // than disappearing — being told what won't import beats wondering later.
  const overCap = slotsLeft !== undefined ? Math.max(0, importable.length - slotsLeft) : 0;
  const newCount = importable.length - overCap;
  const dupCount = parsed.filter((p) => p.duplicate).length;
  const isOverCap = (p: ParsedRow) => overCap > 0 && importable.indexOf(p) >= newCount;

  const doImport = () => {
    const toImport = importable.slice(0, newCount).map((p) => p.row);
    if (toImport.length === 0) {
      setImportedCount(0);
      setStep("done");
      return;
    }
    const payload =
      type === "stock"
        ? ({ type: "stock", rows: toImport as StockRow[] } as const)
        : type === "staff"
          ? ({ type: "staff", rows: toImport as StaffCsvRow[] } as const)
          : type === "account"
            ? ({ type: "account", rows: toImport as AccountRow[] } as const)
            : type === "banking"
              ? ({ type: "banking", rows: toImport as BankingRow[] } as const)
            : ({ type, rows: toImport as ContactRow[] } as const);
    csvImport.mutate(payload, {
      onSuccess: (count) => {
        setImportedCount(count);
        setStep("done");
      },
    });
  };

  return (
    <Modal title={`Import ${template.label.toLowerCase()}`} onClose={onClose}>
      {step === "upload" && (
        <>
          <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "#0369A1", lineHeight: 1.5 }}>
            Upload a CSV with columns: <strong>{template.columns.map((c) => c.csvHeader).join(", ")}</strong>. Only{" "}
            <strong>{requiredCol}</strong> is required. Rows matching an existing name are skipped.
          </div>

          {/* The two columns that only accept certain words, spelled out — the
              rest are free text and speak for themselves. */}
          {type === "staff" && (
            <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: "#374151" }}>employment_type:</strong> {CSV_EMPLOYMENT_TYPE_HINT}
              </div>
              <div>
                <strong style={{ color: "#374151" }}>pay_type:</strong> {CSV_PAY_TYPE_HINT}
              </div>
              <div>
                <strong style={{ color: "#374151" }}>rate:</strong> the amount for that pay type — a daily wage, an hourly rate or a monthly salary
              </div>
              <div>
                <strong style={{ color: "#374151" }}>dates:</strong> YYYY-MM-DD, e.g. 2026-01-15
              </div>
              <div style={{ marginTop: 6 }}>
                Anything it can&apos;t read is flagged before you import, never guessed at silently. Employee numbers are assigned on save, the same as adding someone by hand.
              </div>
            </div>
          )}

          {type === "banking" && (
            <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: "#374151" }}>date:</strong> YYYY-MM-DD, e.g. 2026-08-20. A line without one is skipped.
              </div>
              <div>
                <strong style={{ color: "#374151" }}>amount:</strong> a minus means money out, so an exported statement
                imports as it stands. Or say so in the <strong>type</strong> column: in / out, credit / debit.
              </div>
              <div>
                <strong style={{ color: "#374151" }}>category:</strong> optional. It only sticks if it matches a real SARS
                heading — anything else is flagged and left for you to allocate.
              </div>
              <div style={{ marginTop: 6 }}>
                Everything imports unallocated unless you say otherwise. Work the pile down afterwards from the{" "}
                <strong>Needs a home</strong> filter, where you can match each one to an invoice or bill, or book it
                straight to a heading.
              </div>
            </div>
          )}

          {type === "account" && (
            <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: "#374151" }}>type:</strong>{" "}
                {ACCOUNT_TYPES.map((t) => ACCOUNT_TYPE_META[t].label.toLowerCase()).join(", ")} — the same kinds the Add
                account form offers. Common wording like &quot;cheque&quot; or &quot;credit card&quot; is understood.
              </div>
              <div>
                <strong style={{ color: "#374151" }}>opening_balance:</strong> what the account held on the date below.
                Money in and out is added from that date on.
              </div>
              <div>
                <strong style={{ color: "#374151" }}>opening_balance_date:</strong> YYYY-MM-DD, e.g. 2026-01-15
              </div>
              <div style={{ marginTop: 6 }}>
                Imported accounts are never made the default — set that yourself on the one you meant, afterwards.
              </div>
            </div>
          )}

          <button
            onClick={downloadTemplate}
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1.5px solid #BAE6FD", background: "#F0F9FF", color: "#0369A1", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
          >
            ⬇ Download template CSV
          </button>

          <label
            style={{ display: "block", width: "100%", padding: "18px", borderRadius: 12, border: "1.5px dashed #94a3b8", background: "#f8fafc", textAlign: "center", cursor: "pointer", fontSize: 14, color: "#64748b", fontWeight: 600, boxSizing: "border-box" }}
          >
            📄 Choose CSV file…
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          {parseError && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{parseError}</p>}
        </>
      )}

      {step === "preview" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: "#F0F9FF", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 700, textTransform: "uppercase" }}>Will import</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0C4A6E" }}>{newCount}</div>
            </div>
            <div style={{ flex: 1, background: "#fff7ed", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#92400e", fontWeight: 700, textTransform: "uppercase" }}>Duplicates skipped</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#b45309" }}>{dupCount}</div>
            </div>
          </div>

          {overCap > 0 && (
            <div style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: "#be123c", lineHeight: 1.6 }}>
              Your plan has room for <strong>{slotsLeft}</strong> more, so the last <strong>{overCap}</strong> {overCap === 1 ? "row" : "rows"} won&apos;t
              import. Upgrade and run the same file again — the ones already in are skipped as duplicates.
            </div>
          )}

          <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 16 }}>
            {parsed.map((p, i) => (
              <div key={i} style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13, opacity: p.duplicate || isOverCap(p) ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, color: "#111" }}>{p.name}</span>
                  {p.duplicate && <span style={{ fontSize: 11, color: "#b45309" }}>duplicate — skip</span>}
                  {!p.duplicate && isOverCap(p) && <span style={{ fontSize: 11, color: "#be123c", whiteSpace: "nowrap" }}>over your plan — skip</span>}
                </div>
                {p.issues.map((iss, j) => (
                  <div key={j} style={{ fontSize: 11, color: "#b45309" }}>
                    ⚠ {iss}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <SaveBtn
            label={csvImport.isPending ? "Importing..." : newCount > 0 ? `Import ${newCount}` : "Nothing new to import"}
            icon="⬆"
            onClick={doImport}
            disabled={csvImport.isPending || newCount === 0}
          />
        </>
      )}

      {step === "done" && (
        <>
          <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "18px 16px", fontSize: 14, color: "#0369A1", textAlign: "center", marginBottom: 16 }}>
            ✅ Imported <strong>{importedCount}</strong> {template.label.toLowerCase()}.
          </div>
          <SaveBtn label="Done" icon="✅" onClick={onClose} />
        </>
      )}
    </Modal>
  );
}
