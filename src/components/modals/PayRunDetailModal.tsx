"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { DocumentActions } from "@/components/ui/DocumentActions";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLoans } from "@/lib/supabase/hooks/useWorkerLoans";
import { useDeletePayRun } from "@/lib/supabase/hooks/usePayRuns";
import { loanBalanceOf } from "@/lib/payrunDraft";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { fmt } from "@/lib/format";
import type { Tables } from "@/lib/types/database";
import type { DocForRender } from "@/lib/docgen/buildDocumentHTML";

type PayRun = Tables<"pay_runs">;

// A read-only view of everything a saved pay run holds — the full earnings and
// deductions breakdown, the employer cost, and the payslip to share/download. All
// figures are the snapshot the run was saved with, so this shows exactly what was
// paid, even if the employee's rate has since changed.
export function PayRunDetailModal({ payRun, onClose }: { payRun: PayRun; onClose: () => void }) {
  const { data: staff } = useStaffRegister();
  const { data: loans } = useWorkerLoans();
  const access = useToolAccess("payrun");
  const deletePayRun = useDeletePayRun();
  const [showVoid, setShowVoid] = useState(false);
  const [error, setError] = useState("");
  const worker = (staff ?? []).find((w) => w.id === payRun.staff_id) ?? null;
  const unitLabel = worker?.pay_type === "Hourly" ? "hrs" : "days";

  const units = Number(payRun.units_worked || 0);
  const baseRate = Number(payRun.base_rate || 0);
  const basic = baseRate * units;
  const overtime = Number(payRun.overtime_amount || 0);
  const allowances = Number(payRun.allowances_amount || 0);
  const gross = Number(payRun.gross_wages || 0);
  const uifEmp = Number(payRun.uif_employee || 0);
  const uifEr = Number(payRun.uif_employer || 0);
  const paye = Number(payRun.paye || 0);
  const sdl = Number(payRun.sdl || 0);
  const loan = Number(payRun.loan_deducted || 0);
  const other = Number(payRun.other_deductions || 0);
  const leaveDays = Number(payRun.leave_days || 0);
  const unpaidLeave = Number(payRun.unpaid_leave_amount || 0);
  const net = Number(payRun.net_pay || 0);
  const isApproved = payRun.status === "approved";

  // Unpaid leave changed shape. Runs made before the change paid the full period
  // and then took the unpaid days off the NET; runs made since leave them out of
  // the days, so the gross, UIF and PAYE are already the real ones and nothing is
  // taken off twice. Both are on the books, so the slip works out which it is
  // looking at from the run's own figures rather than guessing from its date: if
  // the net is short by exactly the unpaid amount, it was deducted.
  const netBeforeUnpaid = gross - uifEmp - paye - loan - other;
  const unpaidWasDeducted = unpaidLeave > 0 && Math.abs(netBeforeUnpaid - unpaidLeave - net) < 0.01;

  // Where their advance stands now — the question that follows every deduction.
  // Live, not a snapshot: it's shown as today's balance, not the run's.
  const loanBalance = loanBalanceOf((loans ?? []).filter((l) => l.staff_id === payRun.staff_id));

  const payslipDoc: DocForRender = {
    doc_number: payRun.payslip_number ?? `PAY-${payRun.pay_date}`,
    issue_date: payRun.pay_date,
    recipient_name: payRun.worker_name,
    line_items: [
      { desc: `Basic pay — ${units} ${unitLabel} × ${fmt(baseRate)}`, labour: basic, materials: 0, qty: 1 },
      overtime > 0 ? { desc: "Overtime", labour: overtime, materials: 0, qty: 1 } : null,
      allowances > 0 ? { desc: "Allowance", labour: allowances, materials: 0, qty: 1 } : null,
      leaveDays > 0 && payRun.leave_type !== "Unpaid" ? { desc: `${payRun.leave_type ?? "Annual"} leave — ${leaveDays} day${leaveDays !== 1 ? "s" : ""} (noted)`, labour: 0, materials: 0, qty: leaveDays } : null,
      unpaidLeave > 0 ? { desc: `Unpaid leave — ${leaveDays} day${leaveDays !== 1 ? "s" : ""}`, labour: -unpaidLeave, materials: 0, qty: leaveDays } : null,
      { desc: "UIF deduction (employee 1%)", labour: -uifEmp, materials: 0, qty: 1 },
      paye > 0 ? { desc: "PAYE income tax", labour: -paye, materials: 0, qty: 1 } : null,
      loan > 0 ? { desc: "Loan / advance repayment", labour: -loan, materials: 0, qty: 1 } : null,
      other > 0 ? { desc: payRun.other_deduction_desc || "Other deduction", labour: -other, materials: 0, qty: 1 } : null,
    ].filter((i): i is NonNullable<typeof i> => i !== null),
    subtotal: net,
    vat_rate: null,
    vat_amount: 0,
    deposit: 0,
    balance_due: null,
    due_date: payRun.pay_date,
    valid_until: null,
    payslip_meta: [
      { desc: "Pay period", value: `${payRun.pay_period} · paid ${payRun.pay_date}` },
      { desc: `${unitLabel === "hrs" ? "Hours" : "Days"} paid`, value: `${units} ${unitLabel} × ${fmt(baseRate)}` },
      ...(leaveDays > 0 && payRun.leave_type !== "Unpaid" ? [{ desc: "Paid leave", value: `${leaveDays} day${leaveDays === 1 ? "" : "s"} ${payRun.leave_type ?? "Annual"} — paid in full` }] : []),
      ...(unpaidLeave > 0
        ? [{ desc: "Unpaid leave", value: unpaidWasDeducted ? `${fmt(unpaidLeave)} deducted` : `${fmt(unpaidLeave)} not earned — already off the days above` }]
        : []),
      ...(loanBalance > 0 || loan > 0 ? [{ desc: "Advance balance", value: `${fmt(loanBalance)} still owing today${loan > 0 ? ` (after ${fmt(loan)} off this run)` : ""}` }] : []),
    ].map((m) => ({ label: m.desc, value: m.value })),
  };

  const handleVoid = () => {
    setError("");
    deletePayRun.mutate(payRun.id, {
      onSuccess: onClose,
      onError: (e) => setError(e instanceof Error ? e.message : "Couldn't void the pay run."),
    });
  };

  // What this run created, to tell the user exactly what voiding reverses.
  const reversals = [
    `the wage${uifEr > 0 ? "/UIF" : ""}${sdl > 0 ? "/SDL" : ""} expense on your books`,
    loan > 0 ? "the advance repayment — restores the outstanding balance" : null,
    // Unpaid leave consumes no balance, so don't claim voiding restores one — it
    // just removes the record (matching how the payslip/wizard gate on Unpaid).
    leaveDays > 0
      ? payRun.leave_type === "Unpaid"
        ? "the unpaid-leave record for this run"
        : "the leave recorded here — restores the leave balance"
      : null,
  ].filter(Boolean) as string[];

  return (
    <Modal title={`Payslip ${payRun.payslip_number ?? ""}`.trim()} onClose={onClose}>
      <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>{payRun.worker_name}</div>
            <div style={{ fontSize: 12, color: "#7DD3FC", marginTop: 2 }}>{payRun.pay_period} · {payRun.pay_date}</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: isApproved ? "rgba(56,189,248,0.25)" : "rgba(245,158,11,0.25)", color: isApproved ? "#7DD3FC" : "#FCD34D" }}>
            {isApproved ? "✔️ Approved" : "Prepared"}
          </span>
        </div>
        {/* tone="dark" throughout: Row's default palette is navy text, and this
            card is navy — the whole slip used to be invisible on it bar the net. */}
        <Row tone="dark" label={`Basic (${units} ${unitLabel} × ${fmt(baseRate)})`} value={fmt(basic)} />
        {overtime > 0 && <Row tone="dark" label="Overtime" value={fmt(overtime)} />}
        {allowances > 0 && <Row tone="dark" label="Allowance" value={fmt(allowances)} />}
        <Row tone="dark" label="Gross wages" value={fmt(gross)} bold />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 8, paddingTop: 8 }}>
          <Row tone="dark" label="UIF (employee 1%)" value={`−${fmt(uifEmp)}`} />
          {paye > 0 && <Row tone="dark" label="PAYE" value={`−${fmt(paye)}`} />}
          {loan > 0 && <Row tone="dark" label="Advance repayment" value={`−${fmt(loan)}`} />}
          {other > 0 && <Row tone="dark" label={payRun.other_deduction_desc || "Other deduction"} value={`−${fmt(other)}`} />}
          {leaveDays > 0 && payRun.leave_type !== "Unpaid" && <Row tone="dark" label={`${payRun.leave_type ?? "Annual"} leave (${leaveDays}d)`} value="paid in full" />}
          {unpaidLeave > 0 &&
            (unpaidWasDeducted ? (
              <Row tone="dark" label={`Unpaid leave (${leaveDays}d)`} value={`−${fmt(unpaidLeave)}`} />
            ) : (
              // Newer runs leave the unpaid days out of the days paid, so this is
              // a note, not a deduction — no minus sign, or it reads as one.
              <Row tone="dark" label={`Unpaid leave${leaveDays > 0 ? ` (${leaveDays}d)` : ""} — already off the days`} value={`${fmt(unpaidLeave)} not earned`} />
            ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#38BDF8", fontWeight: 700 }}>NET PAY (take-home)</span>
          <span style={{ fontSize: 24, color: "#fff", fontWeight: 900, whiteSpace: "nowrap" }}>{fmt(net)}</span>
        </div>
        {(loanBalance > 0 || loan > 0) && (
          <div style={{ background: "rgba(245,158,11,0.15)", borderRadius: 10, padding: "8px 11px", marginTop: 10, fontSize: 11.5, color: "#FCD34D", lineHeight: 1.5 }}>
            💰 Advance: <span style={{ fontWeight: 800 }}>{fmt(loanBalance)}</span> still owing today
            {loan > 0 ? ` · ${fmt(loan)} came off on this run` : ""}
          </div>
        )}
      </div>

      <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Employer cost (SARS)</div>
        <Row label="UIF employer (1%)" value={fmt(uifEr)} />
        {sdl > 0 && <Row label="SDL (1%)" value={fmt(sdl)} />}
        <Row label="Total" value={fmt(uifEr + sdl)} bold />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 8 }}>Payslip</div>
      <DocumentActions
        doc={payslipDoc}
        kind="payslip"
        sourceId={payRun.id}
        shareText={`Payslip for ${payRun.worker_name} — ${payRun.pay_period} ${payRun.pay_date}. Net pay: ${fmt(net)}.`}
      />

      {/* Made a mistake? Voiding removes this run and reverses everything it
          created, so you can re-issue a corrected one. Approve-level only — the
          same permission that finalises a run can undo it. */}
      {access.canApprove && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowVoid((p) => !p)}
            style={{ width: "100%", background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 12, padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#be123c" }}>🗑️ Made a mistake? Void this pay run</span>
            <span style={{ color: "#be123c" }}>{showVoid ? "▲" : "▼"}</span>
          </button>
          {showVoid && (
            <div style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 12, padding: 14, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.6, marginBottom: 8 }}>
                This deletes the pay run and reverses everything it created:
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {reversals.map((r) => (
                    <li key={r} style={{ marginBottom: 2 }}>{r}</li>
                  ))}
                </ul>
              </div>
              <div style={{ fontSize: 11, color: "#b45309", lineHeight: 1.5, marginBottom: 10, fontStyle: "italic" }}>
                To correct a mistake, void this run then create a fresh one with “+ New”. This can&apos;t be undone.
              </div>
              {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{error}</p>}
              <button
                onClick={handleVoid}
                disabled={deletePayRun.isPending}
                style={{ width: "100%", background: "#be123c", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 13, fontWeight: 700, cursor: deletePayRun.isPending ? "default" : "pointer", opacity: deletePayRun.isPending ? 0.6 : 1 }}
              >
                {deletePayRun.isPending ? "Voiding..." : "Confirm — void this pay run"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
