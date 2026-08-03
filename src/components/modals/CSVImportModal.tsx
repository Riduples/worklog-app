"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Modal } from "@/components/ui/Modal";
import { SaveBtn } from "@/components/ui/SaveBtn";
import {
  CSV_TEMPLATES,
  buildTemplateCsv,
  PAYMENT_BEHAVIOURS,
  PAYMENT_TERMS,
  type CsvImportType,
} from "@/lib/csvTemplates";
import { useCsvImport, fetchExistingNames } from "@/lib/supabase/hooks/useCsvImport";
import { normaliseItemType, ITEM_TYPE_META } from "@/lib/itemTypes";
import type { TablesInsert } from "@/lib/types/database";

type StockRow = Omit<TablesInsert<"stock_items">, "user_id" | "business_id">;
type ContactRow = Omit<TablesInsert<"contacts">, "user_id" | "business_id">;
type ParsedRow = { row: StockRow | ContactRow; name: string; issues: string[]; duplicate: boolean };

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};

export function CSVImportModal({ type, onClose }: { type: CsvImportType; onClose: () => void }) {
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
          // Stock templates ship a "description" column now; older files (and
          // contacts) still use "name". Accept either, name wins as fallback.
          const name = ((type === "stock" ? raw.description ?? raw.name : raw.name) ?? "").trim();
          if (!name) continue; // skip blank-name rows entirely
          const key = name.toLowerCase();
          const issues: string[] = [];
          const duplicate = existing.has(key) || seenInFile.has(key);
          seenInFile.add(key);

          let row: StockRow | ContactRow;
          if (type === "stock") {
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
              issues.push(`payment_behaviour "${behaviour}" not recognised — will use the default (Good payer)`);
            }
            if (type === "supplier" && terms && !PAYMENT_TERMS.includes(terms)) {
              issues.push(`payment_terms "${terms}" not recognised — will use the default (On delivery)`);
            }
            // Match the manual form, which always has a payment option selected:
            // fall back to its default when the cell is blank or unrecognised.
            row = {
              contact_type: type,
              name,
              phone: (raw.phone ?? "").trim() || null,
              email: (raw.email ?? "").trim() || null,
              address: (raw.address ?? "").trim() || null,
              notes: (raw.notes ?? "").trim() || null,
              payment_behaviour: type === "client" ? (PAYMENT_BEHAVIOURS.includes(behaviour) ? behaviour : "Good payer") : null,
              payment_terms: type === "supplier" ? (PAYMENT_TERMS.includes(terms) ? terms : "On delivery") : null,
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

  const doImport = () => {
    const toImport = parsed.filter((p) => !p.duplicate).map((p) => p.row);
    if (toImport.length === 0) {
      setImportedCount(0);
      setStep("done");
      return;
    }
    const payload =
      type === "stock"
        ? ({ type: "stock", rows: toImport as StockRow[] } as const)
        : ({ type, rows: toImport as ContactRow[] } as const);
    csvImport.mutate(payload, {
      onSuccess: (count) => {
        setImportedCount(count);
        setStep("done");
      },
    });
  };

  const newCount = parsed.filter((p) => !p.duplicate).length;
  const dupCount = parsed.filter((p) => p.duplicate).length;

  return (
    <Modal title={`Import ${template.label.toLowerCase()}`} onClose={onClose}>
      {step === "upload" && (
        <>
          <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "#0369A1", lineHeight: 1.5 }}>
            Upload a CSV with columns: <strong>{template.columns.map((c) => c.csvHeader).join(", ")}</strong>. Only{" "}
            <strong>{requiredCol}</strong> is required. Rows matching an existing name are skipped.
          </div>

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

          <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 16 }}>
            {parsed.map((p, i) => (
              <div key={i} style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13, opacity: p.duplicate ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, color: "#111" }}>{p.name}</span>
                  {p.duplicate && <span style={{ fontSize: 11, color: "#b45309" }}>duplicate — skip</span>}
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
