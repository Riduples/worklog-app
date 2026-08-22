// The payslip document for one computed run — the thing that gets printed,
// PDF'd, shared and archived.
//
// It carries the run's working with it (the period, how the days were arrived at,
// the leave that moved them) and the advance balance the employee will ask about,
// so the slip in their hand answers the same questions the wizard answered on
// screen rather than being a bare list of amounts.
import { fmt } from "@/lib/format";
import type { LeaveBalances } from "@/lib/payroll";
import type { PayPeriod } from "@/lib/payrunCalc";
import type { ComputedRun } from "@/lib/payrunDraft";
import type { DocForRender } from "@/lib/docgen/buildDocumentHTML";

export function buildPayslipDoc({
  run,
  docNumber,
  payPeriod,
  payDate,
  periodStart,
  periodEnd,
  leaveBalances,
}: {
  run: ComputedRun;
  docNumber: string;
  payPeriod: PayPeriod;
  payDate: string;
  periodStart: string;
  periodEnd: string;
  leaveBalances?: LeaveBalances | null;
}): DocForRender {
  const { worker, money, rates, days, draft } = run;
  const unit = rates.unitLabel === "hours" ? "hrs" : "days";
  const paidLeave = run.registerLeave.paidDays + run.extraPaidLeaveDays;

  const meta: Array<{ label: string; value: string }> = [
    { label: "Pay period", value: `${payPeriod} · ${periodStart} → ${periodEnd}` },
    {
      label: `${rates.unitLabel === "hours" ? "Hours" : "Days"} paid`,
      value: `${run.units} ${rates.unitLabel}${run.unitsAreAuto ? "" : " (entered)"} · ${days.scheduledDays} working day${days.scheduledDays === 1 ? "" : "s"} in the period${
        days.proratedStart ? `, employed from ${days.from}` : ""
      }${days.proratedEnd ? `, last day ${days.to}` : ""}`,
    },
  ];
  if (paidLeave > 0) meta.push({ label: "Paid leave", value: `${paidLeave} day${paidLeave === 1 ? "" : "s"} — paid in full, no reduction` });
  if (run.unpaidLeaveDays > 0)
    meta.push({ label: "Unpaid leave", value: `${run.unpaidLeaveDays} day${run.unpaidLeaveDays === 1 ? "" : "s"} — ${fmt(run.unpaidLeaveValue)} not earned (already off the days above)` });
  if (run.loanBalance > 0 || money.loanDeduction > 0)
    meta.push({
      label: "Advance balance",
      value: `${fmt(run.loanBalance)} owing${money.loanDeduction > 0 ? `, less ${fmt(money.loanDeduction)} this run` : ""} → ${fmt(run.loanBalanceAfter)} still owing`,
    });
  if (leaveBalances && !worker.is_contractor)
    meta.push({ label: "Leave left", value: `Annual ${leaveBalances.annualBalance}d · Sick ${leaveBalances.sickBalance}d · Family ${leaveBalances.familyBalance}d` });

  return {
    doc_number: docNumber,
    issue_date: payDate,
    recipient_name: worker.full_name,
    line_items: [
      { desc: `Basic pay — ${run.units} ${unit} × ${fmt(rates.unitRate)}`, labour: money.basic, materials: 0, qty: run.units },
      money.overtime > 0
        ? {
            desc: run.overtimeIsAuto ? `Overtime — ${draft.otUnits} ${draft.otBasis === "hours" ? "hrs" : "days"} × ${draft.otMultiplier}× rate` : "Overtime",
            labour: money.overtime,
            materials: 0,
            qty: 1,
          }
        : null,
      money.allowance > 0 ? { desc: draft.allowanceDesc || "Allowance", labour: money.allowance, materials: 0, qty: 1 } : null,
      money.uifEmployee > 0 ? { desc: "UIF deduction (employee 1%)", labour: -money.uifEmployee, materials: 0, qty: 1 } : null,
      money.paye > 0 ? { desc: "PAYE income tax", labour: -money.paye, materials: 0, qty: 1 } : null,
      money.loanDeduction > 0 ? { desc: "Loan / advance repayment", labour: -money.loanDeduction, materials: 0, qty: 1 } : null,
      money.otherDeduction > 0 ? { desc: draft.otherDeductionDesc || "Other deduction", labour: -money.otherDeduction, materials: 0, qty: 1 } : null,
    ].filter((i): i is NonNullable<typeof i> => i !== null),
    subtotal: money.net,
    vat_rate: null,
    vat_amount: 0,
    deposit: 0,
    balance_due: null,
    due_date: payDate,
    valid_until: null,
    payslip_meta: meta,
  };
}
