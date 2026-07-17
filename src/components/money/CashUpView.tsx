"use client";

import { useState } from "react";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useCashUps, useCreateCashUp } from "@/lib/supabase/hooks/useCashUps";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Row } from "@/components/ui/Row";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { fmt, todayStr } from "@/lib/format";
import { canEdit } from "@/lib/permissions";
import { BackLink } from "@/components/ui/BackLink";

export function CashUpView() {
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: cashUps } = useCashUps();
  const { data: currentMember } = useCurrentMember();
  const createCashUp = useCreateCashUp();

  const [date, setDate] = useState(todayStr());
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const member = currentMember ?? { role: "owner", permissions: {} };
  const mayEdit = canEdit(member, "cashup");

  const cashIn = (income ?? [])
    .filter((r) => r.transaction_date === date && r.payment_method === "Cash")
    .reduce((s, r) => s + Number(r.amount), 0);
  const cashOut = (expenses ?? [])
    .filter((r) => r.transaction_date === date && r.payment_method === "Cash")
    .reduce((s, r) => s + Number(r.amount), 0);
  const expected = cashIn - cashOut;
  const countedNum = parseFloat(counted || "0");
  const variance = counted !== "" ? countedNum - expected : null;

  const alreadyDone = (cashUps ?? []).find((c) => c.cash_up_date === date);

  const handleSave = () => {
    if (counted === "") {
      setError("Enter the counted cash amount.");
      return;
    }
    setError("");
    createCashUp.mutate(
      {
        cash_up_date: date,
        cash_in: cashIn,
        cash_out: cashOut,
        expected,
        counted: countedNum,
        variance: variance ?? 0,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          setCounted("");
          setNotes("");
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save the cash-up."),
      }
    );
  };

  const varianceStyle =
    variance === null
      ? null
      : Math.abs(variance) < 1
        ? { bg: "#F0F9FF", border: "#BAE6FD", fg: "#0369A1" }
        : Math.abs(variance) <= 20
          ? { bg: "#fff7ed", border: "#fed7aa", fg: "#92400e" }
          : { bg: "#fff1f2", border: "#fecdd3", fg: "#be123c" };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Daily Cash-Up</h1>

      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700 }}>🧮 Cash-Up</span> — Count the cash in your till at the end of the day and check it matches what you logged. Small differences are normal; big ones are worth a second look.
      </div>

      <Field label="Date">
        <Input type="date" value={date} onChange={setDate} />
      </Field>

      {alreadyDone && (
        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#64748b" }}>
          ℹ️ A cash-up for {date} was already saved (counted {fmt(alreadyDone.counted)}). Saving again adds another record.
        </div>
      )}

      <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <Row label="Cash in (logged today)" value={fmt(cashIn)} />
        <Row label="Cash out (logged today)" value={fmt(cashOut)} />
        <Row label="Expected in till" value={fmt(expected)} bold />
      </div>

      <Field label="Counted cash (what's actually in the till)">
        <Input type="number" value={counted} onChange={setCounted} placeholder="0.00" />
      </Field>

      {variance !== null && varianceStyle && (
        <div style={{ background: varianceStyle.bg, border: `1.5px solid ${varianceStyle.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: varianceStyle.fg }}>
            {variance === 0 ? "✅ Matches exactly" : variance > 0 ? "Till has more than expected" : "Till has less than expected"}
          </span>
          <span style={{ fontSize: 17, fontWeight: 800, color: varianceStyle.fg }}>{fmt(Math.abs(variance))}</span>
        </div>
      )}

      <Field label="Notes (optional)">
        <Input value={notes} onChange={setNotes} placeholder="e.g. Gave R20 change short, forgot to log a sale..." />
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {mayEdit ? (
        <SaveBtn label={createCashUp.isPending ? "Saving..." : "Save Cash-Up"} icon="🧮" onClick={handleSave} disabled={createCashUp.isPending} />
      ) : (
        <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#1e40af", fontWeight: 600 }}>
          👁 View only — you don&apos;t have permission to log cash-ups
        </div>
      )}

      {(cashUps ?? []).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Recent cash-ups</div>
          {(cashUps ?? []).slice(0, 10).map((c) => {
            const v = Number(c.variance);
            const color = Math.abs(v) < 1 ? "#0369A1" : Math.abs(v) <= 20 ? "#92400e" : "#be123c";
            return (
              <div key={c.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{c.cash_up_date}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      Expected {fmt(c.expected)} · Counted {fmt(c.counted)}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color }}>
                    {v === 0 ? "✅ Exact" : `${v > 0 ? "+" : "−"}${fmt(Math.abs(v))}`}
                  </span>
                </div>
                {c.notes && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{c.notes}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
