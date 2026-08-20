"use client";

import { useState } from "react";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useCashUps, useCreateCashUp, useUpdateCashUp, type CashUp } from "@/lib/supabase/hooks/useCashUps";
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
  const updateCashUp = useUpdateCashUp();

  const [date, setDate] = useState(todayStr());
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const isEdit = editId !== null;
  const saving = createCashUp.isPending || updateCashUp.isPending;

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

  const alreadyDone = !isEdit && (cashUps ?? []).find((c) => c.cash_up_date === date);

  // The running total, and the only one worth running. Counted cash is a
  // snapshot of one evening's cash — adding those up across days counts the same
  // float over and over and means nothing. The variances DO add up: each is a
  // real gain or loss on the day, so their sum is what the cash has actually cost
  // or made since you started. Cash in and out foot the same way.
  const all = cashUps ?? [];
  const netVariance = all.reduce((s, c) => s + Number(c.variance || 0), 0);
  const totalCashIn = all.reduce((s, c) => s + Number(c.cash_in || 0), 0);
  const totalCashOut = all.reduce((s, c) => s + Number(c.cash_out || 0), 0);
  const overDays = all.filter((c) => Number(c.variance || 0) > 0.005).length;
  const shortDays = all.filter((c) => Number(c.variance || 0) < -0.005).length;
  const exactDays = all.length - overDays - shortDays;
  const listed = showAll ? all : all.slice(0, 10);
  const netVarianceFg = Math.abs(netVariance) < 1 ? "#0369A1" : netVariance > 0 ? "#92400e" : "#be123c";

  const resetForm = () => {
    setEditId(null);
    setDate(todayStr());
    setCounted("");
    setNotes("");
    setError("");
  };

  const startEdit = (c: CashUp) => {
    setEditId(c.id);
    setDate(c.cash_up_date);
    setCounted(String(c.counted));
    setNotes(c.notes ?? "");
    setError("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = () => {
    if (counted === "") {
      setError("Enter the counted cash amount.");
      return;
    }
    setError("");
    const changes = {
      cash_up_date: date,
      cash_in: cashIn,
      cash_out: cashOut,
      expected,
      counted: countedNum,
      variance: variance ?? 0,
      notes: notes.trim() || null,
    };
    if (editId !== null) {
      updateCashUp.mutate(
        { id: editId, changes },
        {
          onSuccess: resetForm,
          onError: (e) => setError(e instanceof Error ? e.message : "Couldn't update the cash-up."),
        }
      );
    } else {
      createCashUp.mutate(changes, {
        onSuccess: () => {
          setCounted("");
          setNotes("");
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save the cash-up."),
      });
    }
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
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Cash-ups</h1>

      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700 }}>🧮 Cash-Up</span> — Count your cash at the end of the day and check it matches what you logged. Small differences are normal; big ones are worth a second look.
      </div>

      <Field label="Date">
        <Input type="date" value={date} onChange={setDate} />
      </Field>

      {/* This day is already done. Saying so and stopping there is what produced
          two cash-ups for one evening — the honest fix is the button, because
          "I already did this and got it wrong" is the only reason anyone lands
          back on a date they have counted. */}
      {alreadyDone && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "11px 14px", marginBottom: 12, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
          ℹ️ {date} is already cashed up — counted {fmt(alreadyDone.counted)}.
          {mayEdit && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => startEdit(alreadyDone)}
                style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 800, color: "#92400e", textDecoration: "underline", cursor: "pointer" }}
              >
                Fix that one instead
              </button>{" "}
              — saving here adds a second record for the same day.
            </>
          )}
        </div>
      )}

      <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <Row label="Cash in (logged this day)" value={fmt(cashIn)} />
        <Row label="Cash out (logged this day)" value={fmt(cashOut)} />
        <Row label="Expected in cash" value={fmt(expected)} bold />
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>
          Every Log income and Log expense entry dated {date} with Cash as its payment method — including a cash
          payment you matched to an invoice. Card and EFT never reach your cash, so they are left out.
        </div>
      </div>

      <Field label="Counted cash - what's actually there">
        <Input type="number" value={counted} onChange={setCounted} placeholder="0.00" />
      </Field>

      {variance !== null && varianceStyle && (
        <div style={{ background: varianceStyle.bg, border: `1.5px solid ${varianceStyle.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: varianceStyle.fg }}>
            {variance === 0 ? "✅ Matches exactly" : variance > 0 ? "More cash than expected" : "Less cash than expected"}
          </span>
          <span style={{ fontSize: 17, fontWeight: 800, color: varianceStyle.fg }}>{fmt(Math.abs(variance))}</span>
        </div>
      )}

      <Field label="Notes - optional">
        <Input value={notes} onChange={setNotes} placeholder="e.g. Gave R20 change short, forgot to log a sale..." />
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {mayEdit ? (
        <>
          {isEdit && (
            <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#92400e" }}>
              ✏️ Editing the cash-up for {date}. The variance will be recalculated when you save.
            </div>
          )}
          <SaveBtn
            label={isEdit ? (saving ? "Updating..." : "Update Cash-Up") : saving ? "Saving..." : "Save Cash-Up"}
            icon={isEdit ? "✏️" : "🧮"}
            onClick={handleSave}
            disabled={saving}
          />
          {isEdit && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              style={{ border: "none", background: "none", width: "100%", marginTop: 10, fontSize: 13, fontWeight: 600, color: "#64748b", cursor: saving ? "default" : "pointer", padding: "6px" }}
            >
              Cancel edit
            </button>
          )}
        </>
      ) : (
        <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#1e40af", fontWeight: 600 }}>
          👁 View only — you don&apos;t have permission to log cash-ups
        </div>
      )}

      {all.length > 0 && (
        <div style={{ marginTop: 22 }}>
          {/* Every day counted so far, and what it adds up to. The headline is the
              net over/short because that is the number a run of small shortages
              hides — one R20 evening is nothing, forty of them is a problem with
              a name. */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            All cash-ups to date
          </div>

          <div
            style={{
              background: Math.abs(netVariance) < 1 ? "#F0F9FF" : netVariance > 0 ? "#fff7ed" : "#fff1f2",
              border: `1.5px solid ${Math.abs(netVariance) < 1 ? "#BAE6FD" : netVariance > 0 ? "#fed7aa" : "#fecdd3"}`,
              borderRadius: 12,
              padding: "13px 15px",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: netVarianceFg }}>
                {Math.abs(netVariance) < 1 ? "Net difference" : netVariance > 0 ? "Net over" : "Net short"}
              </span>
              <span style={{ fontSize: 22, fontWeight: 900, color: netVarianceFg }}>{fmt(Math.abs(netVariance))}</span>
            </div>
            <div style={{ fontSize: 11, color: netVarianceFg, opacity: 0.85, marginTop: 3, lineHeight: 1.5 }}>
              Across {all.length} day{all.length === 1 ? "" : "s"} counted — {exactDays} exact, {overDays} over,{" "}
              {shortDays} short.
            </div>
            <div style={{ borderTop: `1px solid ${Math.abs(netVariance) < 1 ? "#BAE6FD" : netVariance > 0 ? "#fed7aa" : "#fecdd3"}`, marginTop: 10, paddingTop: 9 }}>
              <Row label="Cash in, all days" value={fmt(totalCashIn)} />
              <Row label="Cash out, all days" value={fmt(totalCashOut)} />
            </div>
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>
              The counted amounts aren&apos;t added up — each one is that evening&apos;s cash, and the same float would
              be counted again every day.
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
            {showAll ? `Every cash-up (${all.length})` : "Recent cash-ups"}
          </div>
          {mayEdit && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10, lineHeight: 1.5 }}>
              Tap any day to fix what you counted or the note on it. The difference is worked out again when you save.
            </div>
          )}

          {listed.map((c) => {
            const v = Number(c.variance);
            const color = Math.abs(v) < 1 ? "#0369A1" : Math.abs(v) <= 20 ? "#92400e" : "#be123c";
            const editing = editId === c.id;
            return (
              <div
                key={c.id}
                onClick={mayEdit ? () => startEdit(c) : undefined}
                role={mayEdit ? "button" : undefined}
                tabIndex={mayEdit ? 0 : undefined}
                onKeyDown={mayEdit ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(c); } } : undefined}
                style={{ background: editing ? "#fffbeb" : "#f8fafc", border: `1px solid ${editing ? "#fde68a" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, cursor: mayEdit ? "pointer" : "default" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{c.cash_up_date}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      Expected {fmt(c.expected)} · Counted {fmt(c.counted)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color }}>
                      {v === 0 ? "✅ Exact" : `${v > 0 ? "+" : "−"}${fmt(Math.abs(v))}`}
                    </span>
                    {mayEdit && <span style={{ fontSize: 14 }} aria-hidden>✏️</span>}
                  </div>
                </div>
                {c.notes && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{c.notes}</div>}
              </div>
            );
          })}

          {all.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAll((o) => !o)}
              style={{ width: "100%", border: "1.5px solid #e2e8f0", background: "#fff", borderRadius: 10, padding: "10px", marginTop: 4, fontSize: 12.5, fontWeight: 700, color: "#0C4A6E", cursor: "pointer", fontFamily: "inherit" }}
            >
              {showAll ? "Show recent only" : `Show all ${all.length} cash-ups`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
