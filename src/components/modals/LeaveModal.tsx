"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLeave, useCreateWorkerLeave, useUpdateWorkerLeave, type WorkerLeaveRecord } from "@/lib/supabase/hooks/useWorkerLeave";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { todayStr } from "@/lib/format";
import { calcLeaveBalances } from "@/lib/payroll";

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

// Record leave taken, or edit a manually-recorded entry. "From Pay Run" leave is
// synthesized from pay runs and never edited here. Field order runs who → what
// type → when → how many days → note: the person and kind first, then the dates
// (chronological), then the day count they add up to, then an optional note.
export function LeaveModal({ leave, onClose }: { leave?: WorkerLeaveRecord; onClose: () => void }) {
  const isEdit = !!leave;
  const { data: staff } = useStaffRegister();
  const { data: leaveRecords } = useWorkerLeave();
  const { data: payRuns } = usePayRuns();
  const createLeave = useCreateWorkerLeave();
  const updateLeave = useUpdateWorkerLeave();
  const saving = createLeave.isPending || updateLeave.isPending;

  const [staffId, setStaffId] = useState(leave?.staff_id ?? "");
  const [leaveType, setLeaveType] = useState(leave?.leave_type ?? "Annual");
  const [leaveDays, setLeaveDays] = useState(leave ? String(leave.days) : "");
  const [startDate, setStartDate] = useState(leave?.start_date ?? todayStr());
  const [endDate, setEndDate] = useState(leave?.end_date ?? "");
  const [note, setNote] = useState(leave?.note ?? "");
  const [error, setError] = useState("");

  const selectedWorker = (staff ?? []).find((w) => w.id === staffId) ?? null;

  // Every leave entry for the worker — manual records plus what Pay Run booked —
  // is what the BCEA balance is read from.
  const leaveEntriesFor = (id: string) => [
    ...(leaveRecords ?? []).filter((l) => l.staff_id === id).map((l) => ({ leave_type: l.leave_type, days: l.days, date: l.start_date })),
    ...(payRuns ?? []).filter((p) => p.staff_id === id && (p.leave_days ?? 0) > 0).map((p) => ({ leave_type: p.leave_type ?? "Annual", days: p.leave_days ?? 0, date: p.pay_date })),
  ];
  const lb = selectedWorker ? calcLeaveBalances(selectedWorker.start_date, leaveEntriesFor(selectedWorker.id)) : null;

  const leaveDaysNum = parseFloat(leaveDays || "0");
  const overEntitlement = leaveType === "Annual" && lb && leaveDaysNum > lb.annualBalance;

  const handleSave = () => {
    if (!staffId || !leaveDays) {
      setError("Pick an employee and enter days taken.");
      return;
    }
    setError("");
    const handlers = {
      onSuccess: () => onClose(),
      onError: (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't save leave."),
    };
    if (isEdit) {
      updateLeave.mutate(
        { id: leave.id, changes: { leave_type: leaveType, days: leaveDaysNum, start_date: startDate, end_date: endDate || null, note: note.trim() || null } },
        handlers
      );
      return;
    }
    createLeave.mutate(
      { staff_id: staffId, worker_name: selectedWorker!.full_name, leave_type: leaveType, days: leaveDaysNum, start_date: startDate, end_date: endDate || null, note: note.trim() || null },
      handlers
    );
  };

  return (
    <Modal title={isEdit ? "Edit leave" : "Record leave"} onClose={onClose}>
      {/* WHO — locked once recorded so a leave entry can't jump to another person. */}
      <Field label="Employee">
        {isEdit ? (
          <div style={{ ...selectStyle, background: "#f1f5f9", color: "#111" }}>{leave.worker_name}</div>
        ) : (staff ?? []).length === 0 ? (
          <div style={{ ...selectStyle, color: "#94a3b8", background: "#f8fafc" }}>No employees registered yet — add one in the Staff Register first.</div>
        ) : (
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={selectStyle}>
            <option value="">Select employee</option>
            {(staff ?? []).map((w) => {
              const wlb = calcLeaveBalances(w.start_date, leaveEntriesFor(w.id));
              return (
                <option key={w.id} value={w.id}>
                  {w.full_name}
                  {wlb ? ` — annual ${wlb.annualBalance}d, sick ${wlb.sickBalance}d` : ""}
                </option>
              );
            })}
          </select>
        )}
      </Field>

      {lb && (
        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Balance remaining</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            {[
              ["Annual", lb.annualBalance, lb.annualBalance === 0],
              ["Sick", lb.sickBalance, lb.sickBalance < 5],
              ["Family", lb.familyBalance, lb.familyBalance === 0],
            ].map(([type, bal, warn]) => (
              <div key={type as string} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 10, color: "#7DD3FC", textTransform: "uppercase", letterSpacing: 0.3 }}>{type as string}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: warn ? "#FCA5A5" : "#fff" }}>{bal as number}d</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WHAT — the kind of leave. */}
      <Field label="Leave type">
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={selectStyle}>
          <option value="Annual">Annual leave — BCEA (15 working days/year)</option>
          <option value="Sick">Sick leave — BCEA (30 days per 3-yr cycle)</option>
          <option value="Family">Family responsibility — BCEA (3 days/year)</option>
          <option value="Unpaid">Unpaid leave</option>
          <option value="Maternity">Maternity leave (4 months — UIF claim)</option>
          <option value="Parental">Parental leave (10 days)</option>
        </select>
      </Field>

      {/* WHEN — the dates, in order. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={setStartDate} />
        </Field>
        <Field label="End date">
          <Input type="date" value={endDate} onChange={setEndDate} />
        </Field>
      </div>
      {endDate && endDate < startDate && (
        <p style={{ color: "#dc2626", fontSize: 12, marginTop: -2, marginBottom: 10 }}>End date is before the start date — check the dates.</p>
      )}

      {/* HOW MANY — working days it comes to (weekends/holidays excluded, so it's
          entered rather than derived from the dates). */}
      <Field label="Days taken (working days)">
        <Input type="number" value={leaveDays} onChange={setLeaveDays} placeholder="e.g. 3" autoFocus={!isEdit} />
      </Field>

      {leaveType === "Maternity" && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 12, color: "#92400e" }}>
          💡 Employee can claim UIF maternity benefits — refer to nearest Labour Centre or uFiling.gov.za
        </div>
      )}
      {overEntitlement && lb && (
        <div style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 12, color: "#be123c" }}>
          ⚠️ {selectedWorker?.full_name} only has {lb.annualBalance} day{lb.annualBalance !== 1 ? "s" : ""} annual leave remaining. Recording this will exceed their entitlement.
        </div>
      )}

      {/* WHY / NOTE — optional. */}
      <Field label="Note - optional">
        <Input value={note} onChange={setNote} placeholder="e.g. Medical certificate provided" />
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Record Leave"} icon="🏖️" onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
