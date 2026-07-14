"use client";

import { useState } from "react";
import Link from "next/link";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLeave, useCreateWorkerLeave } from "@/lib/supabase/hooks/useWorkerLeave";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { todayStr } from "@/lib/format";
import { calcLeaveBalances } from "@/lib/payroll";

export function LeaveView() {
  const { data: staff } = useStaffRegister();
  const { data: leaveRecords } = useWorkerLeave();
  const { data: payRuns } = usePayRuns();
  const createLeave = useCreateWorkerLeave();

  const [staffId, setStaffId] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [leaveType, setLeaveType] = useState("Annual");
  const [leaveDays, setLeaveDays] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const selectedWorker = (staff ?? []).find((w) => w.id === staffId) ?? null;

  const leaveEntriesFor = (id: string) => [
    ...(leaveRecords ?? []).filter((l) => l.staff_id === id).map((l) => ({ leave_type: l.leave_type, days: l.days, date: l.start_date })),
    ...(payRuns ?? []).filter((p) => p.staff_id === id && (p.leave_days ?? 0) > 0).map((p) => ({ leave_type: p.leave_type ?? "Annual", days: p.leave_days ?? 0, date: p.pay_date })),
  ];
  const lb = selectedWorker ? calcLeaveBalances(selectedWorker.start_date, leaveEntriesFor(selectedWorker.id)) : null;

  const history = staffId
    ? [
        ...(leaveRecords ?? []).filter((l) => l.staff_id === staffId).map((l) => ({ date: l.start_date, leave_type: l.leave_type, days: l.days, note: l.note })),
        ...(payRuns ?? [])
          .filter((p) => p.staff_id === staffId && (p.leave_days ?? 0) > 0)
          .map((p) => ({ date: p.pay_date, leave_type: p.leave_type ?? "Annual", days: p.leave_days ?? 0, note: "from Pay Run" })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const leaveDaysNum = parseFloat(leaveDays || "0");
  const overEntitlement = leaveType === "Annual" && lb && leaveDaysNum > lb.annualBalance;

  const handleSave = () => {
    if (!staffId || !leaveDays) {
      setError("Pick an employee and enter days taken.");
      return;
    }
    setError("");
    createLeave.mutate(
      { staff_id: staffId, worker_name: selectedWorker!.full_name, leave_type: leaveType, days: leaveDaysNum, start_date: startDate, note: note || null },
      {
        onSuccess: () => {
          setLeaveDays("");
          setNote("");
          setStartDate(todayStr());
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't record leave."),
      }
    );
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
          ← Dashboard
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Leave</h1>
      </div>

      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700 }}>🏖️ Leave</span> — Record leave per employee. Balances calculate automatically from their start date per BCEA. Leave here and in Pay Run both count toward the balance.
      </div>

      <Field label="Employee">
        <div style={{ position: "relative" }}>
          <Input value={selectedWorker?.full_name ?? ""} onChange={() => {}} placeholder="Select employee to see balances" />
          <button
            onClick={() => setShowPicker((p) => !p)}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#0C4A6E", border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {showPicker ? "✕" : "👤 Pick"}
          </button>
        </div>
        {showPicker && (
          <div style={{ background: "#fff", border: "1.5px solid #BAE6FD", borderRadius: 12, marginTop: 6, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            {(staff ?? []).length === 0 && <div style={{ padding: 14, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>No employees in Staff Register yet.</div>}
            {(staff ?? []).map((w) => {
              const wlb = calcLeaveBalances(w.start_date, leaveEntriesFor(w.id));
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    setStaffId(w.id);
                    setShowPicker(false);
                  }}
                  style={{ width: "100%", padding: "12px 14px", border: "none", borderBottom: "1px solid #F0F9FF", background: "#fff", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{w.full_name}</span>
                  {wlb && (
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Annual {wlb.annualBalance}d · Sick {wlb.sickBalance}d
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {lb && (
        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Leave balances — {selectedWorker?.full_name}</div>
          {[
            ["Annual leave", lb.annualBalance, `1.25d/month · ${lb.annualTaken}d taken`, lb.annualBalance === 0],
            ["Sick leave", lb.sickBalance, `3-yr cycle · ${lb.sickTaken}d taken`, lb.sickBalance < 5],
            ["Family responsibility", lb.familyBalance, `Per year · ${lb.familyTaken}d taken`, lb.familyBalance === 0],
          ].map(([type, bal, sub, warn]) => (
            <div key={type as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{type}</div>
                <div style={{ fontSize: 10, color: "#7DD3FC" }}>{sub}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: warn ? "#FCA5A5" : "#7DD3FC" }}>{bal}d remaining</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Record leave taken</div>

      <Field label="Leave type">
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#f8fafc", color: "#111" }}>
          <option value="Annual">Annual leave — BCEA (15 working days/year)</option>
          <option value="Sick">Sick leave — BCEA (30 days per 3-yr cycle)</option>
          <option value="Family">Family responsibility — BCEA (3 days/year)</option>
          <option value="Unpaid">Unpaid leave</option>
          <option value="Public Holiday">Public holiday</option>
          <option value="Maternity">Maternity leave (4 months — UIF claim)</option>
          <option value="Parental">Parental leave (10 days)</option>
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Days taken">
          <Input type="number" value={leaveDays} onChange={setLeaveDays} placeholder="e.g. 3" />
        </Field>
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={setStartDate} />
        </Field>
      </div>

      <Field label="Note (optional)">
        <Input value={note} onChange={setNote} placeholder="e.g. Medical certificate provided" />
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

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createLeave.isPending ? "Saving..." : "Record Leave"} icon="🏖️" onClick={handleSave} disabled={createLeave.isPending} />

      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Leave history — {selectedWorker?.full_name}</div>
          {history.slice(0, 12).map((l, i) => (
            <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>
                  {l.date} · {l.leave_type} leave
                </div>
                {l.note && <div style={{ fontSize: 11, color: "#94a3b8" }}>{l.note}</div>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#0C4A6E" }}>{l.days}d</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
