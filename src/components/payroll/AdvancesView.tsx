"use client";

import { useState } from "react";
import Link from "next/link";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLoans, useCreateAdvance } from "@/lib/supabase/hooks/useWorkerLoans";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { fmt, todayStr } from "@/lib/format";
import { getLoanBalance } from "@/lib/payroll";

export function AdvancesView() {
  const { data: staff } = useStaffRegister();
  const { data: loans } = useWorkerLoans();
  const createAdvance = useCreateAdvance();

  const [staffId, setStaffId] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const selectedWorker = (staff ?? []).find((w) => w.id === staffId) ?? null;
  const balanceFor = (id: string) => getLoanBalance((loans ?? []).filter((l) => l.staff_id === id));
  const totalOutstanding = (staff ?? []).reduce((s, w) => s + balanceFor(w.id), 0);
  const selectedBalance = staffId ? balanceFor(staffId) : 0;
  const workerHistory = staffId
    ? (loans ?? []).filter((l) => l.staff_id === staffId).sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
    : [];

  const handleSave = () => {
    if (!staffId || !amount) {
      setError("Pick an employee and enter an amount.");
      return;
    }
    setError("");
    createAdvance.mutate(
      { staff_id: staffId, worker_name: selectedWorker!.full_name, amount: parseFloat(amount), note: note || null, entry_date: todayStr() },
      {
        onSuccess: () => {
          setAmount("");
          setNote("");
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't record the advance."),
      }
    );
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
          ← Dashboard
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Advances</h1>
      </div>

      <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700 }}>💰 Advances</span> — Record cash advances given to employees. Outstanding balances show here and auto-appear in Pay Run for easy deduction.
      </div>

      {totalOutstanding > 0 && (
        <div style={{ background: "#0C4A6E", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Outstanding advances</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{fmt(totalOutstanding)} total</div>
          {(staff ?? [])
            .filter((w) => balanceFor(w.id) > 0)
            .map((w) => (
              <div key={w.id} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6, marginTop: 6 }}>
                <span style={{ fontSize: 13, color: "#7DD3FC" }}>{w.full_name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B" }}>{fmt(balanceFor(w.id))}</span>
              </div>
            ))}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Record new advance</div>
      <Field label="Employee">
        <div style={{ position: "relative" }}>
          <Input value={selectedWorker?.full_name ?? ""} onChange={() => {}} placeholder="Select employee" />
          <button
            onClick={() => setShowPicker((p) => !p)}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#b45309", border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {showPicker ? "✕" : "👤 Pick"}
          </button>
        </div>
        {showPicker && (
          <div style={{ background: "#fff", border: "1.5px solid #fed7aa", borderRadius: 12, marginTop: 6, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            {(staff ?? []).length === 0 && <div style={{ padding: 14, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>No employees registered.</div>}
            {(staff ?? []).map((w) => {
              const bal = balanceFor(w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    setStaffId(w.id);
                    setShowPicker(false);
                  }}
                  style={{ width: "100%", padding: "11px 14px", border: "none", borderBottom: "1px solid #fff7ed", background: "#fff", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{w.full_name}</span>
                  {bal > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#b45309", background: "#fff7ed", padding: "2px 8px", borderRadius: 8 }}>{fmt(bal)} outstanding</span>}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {selectedWorker && selectedBalance > 0 && (
        <div style={{ background: "#fff7ed", borderRadius: 10, padding: "9px 12px", marginBottom: 10, fontSize: 12, color: "#92400e" }}>
          {selectedWorker.full_name} already owes <strong>{fmt(selectedBalance)}</strong> — this will be added on top.
        </div>
      )}

      <Field label="Amount (R)">
        <Input type="number" value={amount} onChange={setAmount} placeholder="0.00" />
      </Field>
      <Field label="Reason (optional)">
        <Input value={note} onChange={setNote} placeholder="e.g. Emergency, transport, groceries..." />
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createAdvance.isPending ? "Saving..." : "Record Advance"} icon="💰" onClick={handleSave} disabled={createAdvance.isPending} />

      {workerHistory.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{selectedWorker?.full_name} — history</div>
          {workerHistory.map((l) => (
            <div key={l.id} style={{ background: l.loan_type === "advance" ? "#fff7ed" : "#F0F9FF", border: `1px solid ${l.loan_type === "advance" ? "#fed7aa" : "#BAE6FD"}`, borderRadius: 10, padding: "9px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  {l.entry_date} · {l.loan_type === "advance" ? "Advance given" : "Repaid from wages"}
                </div>
                {l.note && <div style={{ fontSize: 11, color: "#64748b" }}>{l.note}</div>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: l.loan_type === "advance" ? "#b45309" : "#0C4A6E" }}>
                {l.loan_type === "advance" ? "+" : "−"}
                {fmt(l.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
