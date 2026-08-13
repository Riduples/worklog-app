"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLoans, useCreateAdvance, useUpdateAdvance, type WorkerLoan } from "@/lib/supabase/hooks/useWorkerLoans";
import { getLoanBalance } from "@/lib/payroll";
import { fmt, todayStr } from "@/lib/format";

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 12,
  border: "1.5px solid #e2e8f0",
  fontSize: 15,
  background: "#fff",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

// Record a cash advance, or edit one already given. Repayment rows are only ever
// created by Pay Run, so this only ever touches 'advance' entries. The field order
// runs who → how much → how it's paid back → why: the two required fields first,
// the repayment plan (which drives the Pay Run deduction) next, the optional
// reason last.
export function AdvanceModal({ advance, onClose }: { advance?: WorkerLoan; onClose: () => void }) {
  const isEdit = !!advance;
  const { data: staff } = useStaffRegister();
  const { data: loans } = useWorkerLoans();
  const createAdvance = useCreateAdvance();
  const updateAdvance = useUpdateAdvance();
  const saving = createAdvance.isPending || updateAdvance.isPending;

  const [staffId, setStaffId] = useState(advance?.staff_id ?? "");
  const [amount, setAmount] = useState(advance ? String(advance.amount) : "");
  const [repayPerRun, setRepayPerRun] = useState(advance?.repay_per_run != null ? String(advance.repay_per_run) : "");
  const [note, setNote] = useState(advance?.note ?? "");
  const [error, setError] = useState("");

  const selectedWorker = (staff ?? []).find((w) => w.id === staffId) ?? null;
  const balanceFor = (id: string) => getLoanBalance((loans ?? []).filter((l) => l.staff_id === id));
  // On a new advance the current balance is what they owe now; the amount entered
  // adds on top. On an edit the balance already includes this row, so leave it.
  const currentBalance = staffId ? balanceFor(staffId) : 0;
  const amountNum = parseFloat(amount) || 0;
  const repayNum = parseFloat(repayPerRun) || 0;
  const newBalance = isEdit ? currentBalance : currentBalance + amountNum;

  const handleSave = () => {
    if (!staffId || !amount) {
      setError("Pick an employee and enter an amount.");
      return;
    }
    setError("");
    const handlers = {
      onSuccess: () => onClose(),
      onError: (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't save the advance."),
    };
    if (isEdit) {
      updateAdvance.mutate({ id: advance.id, changes: { amount: amountNum, repay_per_run: repayNum || null, note: note.trim() || null } }, handlers);
      return;
    }
    createAdvance.mutate(
      { staff_id: staffId, worker_name: selectedWorker!.full_name, amount: amountNum, repay_per_run: repayNum || null, note: note.trim() || null, entry_date: todayStr() },
      handlers
    );
  };

  return (
    <Modal title={isEdit ? "Edit advance" : "Record advance"} onClose={onClose}>
      {/* WHO — locked once given, so an advance can't be reassigned to someone else. */}
      <Field label="Employee">
        {isEdit ? (
          <div style={{ ...selectStyle, background: "#f1f5f9", color: "#111" }}>{advance.worker_name}</div>
        ) : (staff ?? []).length === 0 ? (
          <div style={{ ...selectStyle, color: "#94a3b8", background: "#f8fafc" }}>No employees registered yet — add one in the Staff Register first.</div>
        ) : (
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={selectStyle}>
            <option value="">Select employee</option>
            {(staff ?? []).map((w) => {
              const bal = balanceFor(w.id);
              return (
                <option key={w.id} value={w.id}>
                  {w.full_name}
                  {bal > 0 ? ` — owes ${fmt(bal)}` : ""}
                </option>
              );
            })}
          </select>
        )}
      </Field>

      {!isEdit && selectedWorker && currentBalance > 0 && (
        <div style={{ background: "#fff7ed", borderRadius: 10, padding: "9px 12px", marginBottom: 12, fontSize: 12, color: "#92400e" }}>
          {selectedWorker.full_name} already owes <strong>{fmt(currentBalance)}</strong> — this advance adds on top.
        </div>
      )}

      {/* HOW MUCH */}
      <Field label="Amount (R)">
        <Input type="number" value={amount} onChange={setAmount} placeholder="0.00" autoFocus={!isEdit} />
      </Field>

      {/* HOW IT'S PAID BACK — drives the automatic Pay Run deduction. */}
      <Field label="Repay per pay run (R)">
        <Input type="number" value={repayPerRun} onChange={setRepayPerRun} placeholder="Leave blank to deduct manually" />
      </Field>
      {amountNum > 0 && repayNum > 0 && (
        <div style={{ fontSize: 12, color: "#64748b", margin: "-6px 0 10px" }}>≈ {Math.ceil(amountNum / repayNum)} pay runs to repay</div>
      )}

      {/* WHY — optional. */}
      <Field label="Reason - optional">
        <Input value={note} onChange={setNote} placeholder="e.g. Emergency, transport, groceries..." />
      </Field>

      {amountNum > 0 && (
        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "11px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#38BDF8" }}>{isEdit ? "Advance amount" : `New balance${selectedWorker ? ` for ${selectedWorker.full_name.split(" ")[0]}` : ""}`}</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: "#F59E0B" }}>{fmt(isEdit ? amountNum : newBalance)}</span>
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Record Advance"} icon="💰" onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
