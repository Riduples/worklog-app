"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { BackLink } from "@/components/ui/BackLink";
import { todayStr } from "@/lib/format";
import { TAX_RATES } from "@/lib/taxRates";
import type { Tables } from "@/lib/types/database";

type TaxRateRow = Tables<"tax_rates">;
type BracketDraft = { from: string; base: string; rate: string };
type Draft = {
  id?: string;
  tax_year: string;
  effective_from: string;
  effective_to: string;
  primary_rebate: string;
  secondary_rebate: string;
  tertiary_rebate: string;
  paye_monthly_threshold: string;
  uif_employee_rate: string;
  uif_employer_rate: string;
  uif_ceiling: string;
  sdl_rate: string;
  sdl_annual_threshold: string;
  company_tax_rate: string;
  medical_credit_first_two: string;
  medical_credit_additional: string;
  vat_rate: string;
  mileage_rate: string;
  tax_jar_rate: string;
  note: string;
  brackets: BracketDraft[];
};

// The numeric fields, in display order. Keys match both the Draft and the DB row.
const NUM_FIELDS: { key: keyof Omit<Draft, "id" | "tax_year" | "effective_from" | "effective_to" | "note" | "brackets">; label: string }[] = [
  { key: "primary_rebate", label: "Primary rebate (R/yr)" },
  { key: "secondary_rebate", label: "Secondary rebate — 65+ (R/yr)" },
  { key: "tertiary_rebate", label: "Tertiary rebate — 75+ (R/yr)" },
  { key: "paye_monthly_threshold", label: "PAYE monthly threshold (R)" },
  { key: "medical_credit_first_two", label: "Medical credit — first two (R/mo)" },
  { key: "medical_credit_additional", label: "Medical credit — additional (R/mo)" },
  { key: "uif_employee_rate", label: "UIF employee rate (e.g. 0.01)" },
  { key: "uif_employer_rate", label: "UIF employer rate (e.g. 0.01)" },
  { key: "uif_ceiling", label: "UIF monthly ceiling (R)" },
  { key: "sdl_rate", label: "SDL rate (e.g. 0.01)" },
  { key: "sdl_annual_threshold", label: "SDL exemption threshold (R/yr)" },
  { key: "company_tax_rate", label: "Company tax rate (e.g. 0.27)" },
  { key: "vat_rate", label: "VAT rate (e.g. 0.15)" },
  { key: "mileage_rate", label: "Prescribed rate per km (R)" },
  { key: "tax_jar_rate", label: "Tax jar provision rate (e.g. 0.28)" },
];

const s = (v: number | string) => String(v);

// A trimmed, finite number, or null (blank / not a number) — so a blank field is
// a validation error, never a silent 0.
const parseNum = (raw: string): number | null => {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// Rates stored as a fraction (0.15, not 15) — sanity-checked to catch the classic
// "typed 15 for 15%" that would misprice VAT/tax for every business.
const FRACTION_KEYS: string[] = ["uif_employee_rate", "uif_employer_rate", "sdl_rate", "company_tax_rate", "vat_rate", "tax_jar_rate"];

function rowToDraft(row: TaxRateRow): Draft {
  const brackets: BracketDraft[] = Array.isArray(row.paye_brackets)
    ? (row.paye_brackets as unknown[]).map((b) => {
        const o = (b ?? {}) as Record<string, unknown>;
        return { from: s(Number(o.from)), base: s(Number(o.base)), rate: s(Number(o.rate)) };
      })
    : [];
  return {
    id: row.id,
    tax_year: row.tax_year,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    primary_rebate: s(row.primary_rebate),
    secondary_rebate: s(row.secondary_rebate),
    tertiary_rebate: s(row.tertiary_rebate),
    paye_monthly_threshold: s(row.paye_monthly_threshold),
    uif_employee_rate: s(row.uif_employee_rate),
    uif_employer_rate: s(row.uif_employer_rate),
    uif_ceiling: s(row.uif_ceiling),
    sdl_rate: s(row.sdl_rate),
    sdl_annual_threshold: s(row.sdl_annual_threshold),
    company_tax_rate: s(row.company_tax_rate),
    medical_credit_first_two: s(row.medical_credit_first_two),
    medical_credit_additional: s(row.medical_credit_additional),
    vat_rate: s(row.vat_rate),
    mileage_rate: s(row.mileage_rate),
    tax_jar_rate: s(row.tax_jar_rate),
    note: row.note ?? "",
    brackets,
  };
}

const bumpTaxYear = (ty: string): string => {
  const m = ty.match(/^(\d{4})\/(\d{2})$/);
  if (!m) return "";
  const start = Number(m[1]) + 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
};
const bumpDateYear = (d: string): string => {
  const m = d.match(/^(\d{4})(-\d{2}-\d{2})$/);
  return m ? `${Number(m[1]) + 1}${m[2]}` : d;
};

/** A new draft, pre-filled from the latest year on file so it's a small edit. */
function newDraft(latest: TaxRateRow | undefined): Draft {
  if (latest) {
    return {
      ...rowToDraft(latest),
      id: undefined,
      tax_year: bumpTaxYear(latest.tax_year),
      effective_from: bumpDateYear(latest.effective_from),
      effective_to: bumpDateYear(latest.effective_to),
      note: "",
    };
  }
  // No rows yet — seed from the app's hardcoded fallback.
  const f = TAX_RATES;
  return {
    tax_year: f.TAX_YEAR,
    effective_from: "",
    effective_to: "",
    primary_rebate: s(f.PRIMARY_REBATE),
    secondary_rebate: s(f.SECONDARY_REBATE),
    tertiary_rebate: s(f.TERTIARY_REBATE),
    paye_monthly_threshold: s(f.PAYE_MONTHLY_THRESHOLD),
    uif_employee_rate: s(f.UIF_EMPLOYEE_RATE),
    uif_employer_rate: s(f.UIF_EMPLOYER_RATE),
    uif_ceiling: s(f.UIF_CEILING),
    sdl_rate: s(f.SDL_RATE),
    sdl_annual_threshold: s(f.SDL_ANNUAL_THRESHOLD),
    company_tax_rate: s(f.COMPANY_TAX_RATE),
    medical_credit_first_two: s(f.MEDICAL_CREDIT_FIRST_TWO),
    medical_credit_additional: s(f.MEDICAL_CREDIT_ADDITIONAL),
    vat_rate: s(f.VAT_RATE),
    mileage_rate: s(f.MILEAGE_RATE),
    tax_jar_rate: s(f.TAX_JAR_RATE),
    note: "",
    brackets: f.PAYE_BRACKETS.map((b) => ({ from: s(b.from), base: s(b.base), rate: s(b.rate) })),
  };
}

export function TaxRatesAdminView() {
  const supabase = createClient();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);

  const { data: rows } = useQuery({
    queryKey: ["tax-rates-admin"],
    queryFn: async (): Promise<TaxRateRow[]> => {
      const { data, error } = await supabase.from("tax_rates").select("*").order("effective_from", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = todayStr();
  const list = rows ?? [];
  const activeRow = list.find((r) => r.effective_from <= today && r.effective_to >= today);

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 760, margin: "0 auto" }}>
      <BackLink />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, margin: "4px 0 6px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E" }}>SARS rates (admin)</h1>
        <button
          onClick={() => setEditing(newDraft(list[0]))}
          style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + Add a tax year
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6, marginBottom: 16 }}>
        National SARS figures used across every business for payroll, tax and mileage. The app uses the row whose dates cover
        today; add next year&apos;s figures when the February Budget lands and they take effect automatically on 1 March.
      </p>

      {!activeRow && (
        <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#991B1B", lineHeight: 1.6 }}>
          ⚠️ <strong>No rates on file for the current tax year.</strong> The app is running on its built-in fallback — add
          the current year&apos;s SARS figures so everyone&apos;s payroll and tax are up to date.
        </div>
      )}

      {list.map((r) => {
        const active = r.id === activeRow?.id;
        return (
          <div key={r.id} style={{ background: "#fff", border: `1.5px solid ${active ? "#7DD3FC" : "#e2e8f0"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#0C4A6E" }}>{r.tax_year}</span>
                {active && <span style={{ fontSize: 10, fontWeight: 800, color: "#0369A1", background: "#F0F9FF", borderRadius: 8, padding: "2px 8px" }}>ACTIVE</span>}
              </div>
              <button
                onClick={() => setEditing(rowToDraft(r))}
                style={{ background: "#f0f9ff", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "#1e40af", cursor: "pointer" }}
              >
                Edit
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {r.effective_from} → {r.effective_to}
            </div>
            <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.7 }}>
              Primary rebate R{Number(r.primary_rebate).toLocaleString("en-ZA")} · VAT {(Number(r.vat_rate) * 100).toFixed(0)}% ·
              Company tax {(Number(r.company_tax_rate) * 100).toFixed(0)}% · Mileage R{Number(r.mileage_rate)}/km ·
              {Array.isArray(r.paye_brackets) ? r.paye_brackets.length : 0} PAYE brackets
            </div>
          </div>
        );
      })}

      {editing && (
        <TaxRateEditor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["tax-rates-admin"] });
            qc.invalidateQueries({ queryKey: ["tax-rates"] });
            qc.invalidateQueries({ queryKey: ["tax-rates-coverage"] });
          }}
        />
      )}
    </div>
  );
}

function TaxRateEditor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (key: keyof Draft, value: string) => setD((p) => ({ ...p, [key]: value }));
  const setBracket = (i: number, key: keyof BracketDraft, value: string) =>
    setD((p) => ({ ...p, brackets: p.brackets.map((b, j) => (j === i ? { ...b, [key]: value } : b)) }));
  const addBracket = () => setD((p) => ({ ...p, brackets: [...p.brackets, { from: "", base: "", rate: "" }] }));
  const removeBracket = (i: number) => setD((p) => ({ ...p, brackets: p.brackets.filter((_, j) => j !== i) }));

  const handleSave = async () => {
    setError("");
    if (!d.tax_year.trim() || !d.effective_from || !d.effective_to) {
      setError("Tax year and both effective dates are required.");
      return;
    }
    if (d.effective_to < d.effective_from) {
      setError("The effective-to date must be on or after effective-from.");
      return;
    }

    // Every numeric field must be a real number — a blank must not become 0.
    const parsed = new Map<string, number>();
    for (const f of NUM_FIELDS) {
      const n = parseNum(d[f.key]);
      if (n === null) {
        setError(`"${f.label}" must be a number.`);
        return;
      }
      parsed.set(f.key, n);
    }
    for (const f of NUM_FIELDS) {
      if (FRACTION_KEYS.includes(f.key)) {
        const v = parsed.get(f.key) as number;
        if (v < 0 || v > 1) {
          setError(`"${f.label}" should be a fraction between 0 and 1 (e.g. 0.15, not 15).`);
          return;
        }
      }
    }
    const g = (k: string) => parsed.get(k) as number;

    // PAYE brackets: drop fully-blank rows, require the rest complete, sort
    // ascending (calcPAYE scans top-down), and require the lowest band to start
    // at 0 — otherwise a stray/mis-ordered band zeroes everyone's PAYE.
    const rows = d.brackets.filter((b) => !(b.from.trim() === "" && b.base.trim() === "" && b.rate.trim() === ""));
    const brackets: { from: number; base: number; rate: number }[] = [];
    for (const b of rows) {
      const from = parseNum(b.from);
      const base = parseNum(b.base);
      const rate = parseNum(b.rate);
      if (from === null || base === null || rate === null) {
        setError("Every PAYE bracket needs a from, base and rate.");
        return;
      }
      if (rate < 0 || rate > 1) {
        setError("PAYE bracket rates should be a fraction between 0 and 1 (e.g. 0.18).");
        return;
      }
      brackets.push({ from, base, rate });
    }
    brackets.sort((a, b) => a.from - b.from);
    const first = brackets[0];
    if (!first || first.from !== 0) {
      setError("The lowest PAYE bracket must start at 0.");
      return;
    }

    const payload = {
      tax_year: d.tax_year.trim(),
      effective_from: d.effective_from,
      effective_to: d.effective_to,
      paye_brackets: brackets,
      primary_rebate: g("primary_rebate"),
      secondary_rebate: g("secondary_rebate"),
      tertiary_rebate: g("tertiary_rebate"),
      paye_monthly_threshold: g("paye_monthly_threshold"),
      uif_employee_rate: g("uif_employee_rate"),
      uif_employer_rate: g("uif_employer_rate"),
      uif_ceiling: g("uif_ceiling"),
      sdl_rate: g("sdl_rate"),
      sdl_annual_threshold: g("sdl_annual_threshold"),
      company_tax_rate: g("company_tax_rate"),
      medical_credit_first_two: g("medical_credit_first_two"),
      medical_credit_additional: g("medical_credit_additional"),
      vat_rate: g("vat_rate"),
      mileage_rate: g("mileage_rate"),
      tax_jar_rate: g("tax_jar_rate"),
      note: d.note.trim() || null,
    };
    setSaving(true);
    const { error } = d.id
      ? await supabase.from("tax_rates").update(payload).eq("id", d.id)
      : await supabase.from("tax_rates").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  };

  return (
    <Modal title={d.id ? `Edit ${d.tax_year}` : "Add a tax year"} onClose={onClose}>
      <Field label="Tax year (e.g. 2027/28)">
        <Input value={d.tax_year} onChange={(v) => setField("tax_year", v)} placeholder="2027/28" />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Effective from">
            <Input value={d.effective_from} onChange={(v) => setField("effective_from", v)} type="date" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Effective to">
            <Input value={d.effective_to} onChange={(v) => setField("effective_to", v)} type="date" />
          </Field>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, margin: "14px 0 8px" }}>
        PAYE brackets (annual)
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, lineHeight: 1.5 }}>
        Each row: income from (R), cumulative base tax (R), marginal rate (e.g. 0.18). Order low to high.
      </div>
      {d.brackets.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <Input value={b.from} onChange={(v) => setBracket(i, "from", v)} type="number" placeholder="from" />
          <Input value={b.base} onChange={(v) => setBracket(i, "base", v)} type="number" placeholder="base" />
          <Input value={b.rate} onChange={(v) => setBracket(i, "rate", v)} type="number" placeholder="rate" />
          <button
            type="button"
            onClick={() => removeBracket(i)}
            style={{ background: "#fff", border: "1.5px solid #fed7aa", color: "#b45309", borderRadius: 8, padding: "8px 10px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addBracket}
        style={{ background: "#f0f9ff", border: "1.5px solid #bfdbfe", color: "#1e40af", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}
      >
        + Add bracket
      </button>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, margin: "16px 0 8px" }}>
        Rebates, thresholds &amp; rates
      </div>
      {NUM_FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          <Input value={d[f.key]} onChange={(v) => setField(f.key, v)} type="number" />
        </Field>
      ))}

      <Field label="Note (optional)">
        <Input value={d.note} onChange={(v) => setField("note", v)} placeholder="e.g. Budget 2027" />
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save rates"} icon="💾" onClick={handleSave} disabled={saving} allowInReadOnly />
    </Modal>
  );
}
