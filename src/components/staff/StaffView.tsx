"use client";

import { useState } from "react";
import { useStaffRegister, useUpdateStaffMember, type StaffMember } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLoans } from "@/lib/supabase/hooks/useWorkerLoans";
import { useWorkerLeave } from "@/lib/supabase/hooks/useWorkerLeave";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { StaffModal } from "@/components/modals/StaffModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { fmt } from "@/lib/format";
import { calcLeaveBalances, getLoanBalance, rateLabel } from "@/lib/payroll";
import { calcETI, monthsEmployedFrom, monthlyRemunerationOf } from "@/lib/eti";
import { isRestricted, TIERS, type Plan } from "@/lib/tiers";
import { BackLink } from "@/components/ui/BackLink";

const EMPLOYMENT_BADGE: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  contractor: { label: "🧾 Contractor", bg: "#fff7ed", fg: "#92400e", border: "#fed7aa" },
  fixed_term: { label: "📅 Fixed-term", bg: "#f5f3ff", fg: "#6d28d9", border: "#ddd6fe" },
  casual: { label: "🔁 Casual", bg: "#F0F9FF", fg: "#0369A1", border: "#BAE6FD" },
};

// The worker types the register can hold, in the order the Add form offers them.
// Permanent has no badge (it's the unremarkable default) but still needs a label
// here so it can be filtered for.
const WORKER_TYPES = [
  { value: "permanent", label: "👔 Permanent" },
  { value: "fixed_term", label: "📅 Fixed-term" },
  { value: "casual", label: "🔁 Casual" },
  { value: "contractor", label: "🧾 Contractor" },
] as const;

type WorkerTypeFilter = "all" | (typeof WORKER_TYPES)[number]["value"];

// The UI-19 needs a reason for every departure, so it's captured on exit.
const TERM_REASONS = ["Resignation", "Dismissal", "Retrenchment", "Contract ended", "Retirement", "Death", "Other"];

function StaffDetailModal({ staff, onClose, onEdit }: { staff: StaffMember; onClose: () => void; onEdit: (() => void) | null }) {
  const { data: loans } = useWorkerLoans();
  const { data: leave } = useWorkerLeave();
  const { data: payRuns } = usePayRuns();
  const access = useToolAccess("staffregister");
  const updateStaff = useUpdateStaffMember();

  const [showTerminate, setShowTerminate] = useState(false);
  const [termEnd, setTermEnd] = useState("");
  const [termReason, setTermReason] = useState("");
  const [termNotice, setTermNotice] = useState(true);

  const staffLoans = (loans ?? []).filter((l) => l.staff_id === staff.id);
  const staffLeave = (leave ?? []).filter((l) => l.staff_id === staff.id);
  const staffPayRuns = (payRuns ?? []).filter((p) => p.staff_id === staff.id);
  const loanBalance = getLoanBalance(staffLoans);
  const totalPaid = staffPayRuns.reduce((s, p) => s + p.net_pay, 0);

  const leaveEntries = [
    ...staffLeave.map((l) => ({ leave_type: l.leave_type, days: l.days, date: l.start_date })),
    ...staffPayRuns.filter((p) => (p.leave_days ?? 0) > 0).map((p) => ({ leave_type: p.leave_type ?? "Annual", days: p.leave_days ?? 0, date: p.pay_date })),
  ];
  const lb = staff.is_contractor ? null : calcLeaveBalances(staff.start_date, leaveEntries);
  const badge = EMPLOYMENT_BADGE[staff.employment_type];
  const rate = rateLabel(fmt, staff.pay_type, staff.daily_wage ?? 0, staff.hourly_rate ?? 0, staff.monthly_salary ?? 0);

  // ETI is an employees-only, still-employed opportunity: never for a contractor
  // or someone who has already left. calcETI itself excludes contractors and
  // gates age/ceiling — we only skip the call for the terminated case here.
  const isTerminated = staff.terminated === true;
  const eti = !staff.is_contractor && !isTerminated ? calcETI(staff, monthlyRemunerationOf(staff), monthsEmployedFrom(staff.start_date)) : null;

  // Guided (not automated) final-pay figures for the offboarding checklist. The
  // daily rate is derived the same way Pay Run would read it back per pay type.
  const dailyRate =
    staff.pay_type === "Hourly"
      ? (staff.hourly_rate ?? 0) * (staff.hours_per_day ?? 8)
      : staff.pay_type === "Monthly"
        ? (staff.monthly_salary ?? 0) / ((staff.days_per_week ?? 5) * 4.33)
        : staff.daily_wage ?? 0;
  const termMonths = monthsEmployedFrom(staff.start_date);
  const leavePayout = (lb?.annualBalance ?? 0) * dailyRate;

  const handleTerminate = () => {
    updateStaff.mutate(
      { id: staff.id, changes: { terminated: true, term_end_date: termEnd || null, term_reason: termReason || null, term_notice_worked: termNotice } },
      { onSuccess: onClose }
    );
  };

  // Undo an accidental termination — clears the exit details and returns the
  // person to active staff. Leave accrual reads from the untouched start date, so
  // reinstating restores them exactly as they were.
  const handleReinstate = () => {
    if (!confirm(`Reinstate ${staff.full_name}? This clears their leaving date and reason and returns them to active staff.`)) return;
    updateStaff.mutate(
      { id: staff.id, changes: { terminated: false, term_end_date: null, term_reason: null, term_notice_worked: null } },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title={staff.full_name} onClose={onClose}>
      <div style={{ background: "#0C4A6E", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{staff.full_name}</div>
          {badge && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "rgba(255,255,255,0.2)", color: "#fff" }}>
              {badge.label}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "#38BDF8" }}>
          {staff.pay_type} · {rate}
        </div>
        {staff.start_date && !staff.is_contractor && (
          <div style={{ fontSize: 12, color: "#7DD3FC", marginTop: 4 }}>
            Started {staff.start_date} · {lb?.months ?? 0} months employed
          </div>
        )}
        {(staff.recurring_allowance ?? 0) > 0 && (
          <div style={{ fontSize: 12, color: "#7DD3FC", marginTop: 4 }}>
            🔁 {fmt(staff.recurring_allowance ?? 0)}/mo{staff.recurring_allowance_desc ? ` · ${staff.recurring_allowance_desc}` : ""}
          </div>
        )}
        {staff.contract_end_date && <div style={{ fontSize: 12, color: "#F59E0B", marginTop: 4 }}>⚠️ Contract ends {staff.contract_end_date}</div>}
        {staff.is_contractor && staff.trading_name && <div style={{ fontSize: 12, color: "#7DD3FC", marginTop: 4 }}>{staff.trading_name}</div>}
        {staff.is_contractor && (
          <div style={{ background: "rgba(245,158,11,0.2)", borderRadius: 8, padding: "7px 10px", marginTop: 8, fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>
            🧾 Independent contractor — no UIF, no PAYE, no leave obligations
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#7DD3FC", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Total paid (net)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{fmt(totalPaid)}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#7DD3FC", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Pay runs</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{staffPayRuns.length}</div>
          </div>
        </div>
      </div>

      {eti && eti.eligible && (
        <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: "11px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>💚 Qualifies for ETI — ~{fmt(eti.amount)}/month</div>
          <div style={{ fontSize: 11, color: "#16a34a", marginTop: 3, lineHeight: 1.5 }}>
            Estimated saving to claim on your EMP201 — confirm with your accountant.
          </div>
        </div>
      )}
      {eti && !eti.eligible && eti.needsInfo && (
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, lineHeight: 1.5 }}>Add this employee&apos;s SA ID (in Edit) to check ETI eligibility.</div>
      )}

      {isTerminated && (
        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
            🚪 Left{staff.term_end_date ? ` ${staff.term_end_date}` : ""}
            {staff.term_reason ? ` · ${staff.term_reason}` : ""}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>
            Remember to submit a UI-19 to the Department of Labour and issue a Certificate of Service.
          </div>
          {access.canEdit && (
            <button
              onClick={handleReinstate}
              disabled={updateStaff.isPending}
              style={{ width: "100%", marginTop: 10, background: "#fff", border: "1.5px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 700, color: "#0C4A6E", cursor: updateStaff.isPending ? "default" : "pointer", opacity: updateStaff.isPending ? 0.6 : 1 }}
            >
              ↩️ Reinstate
            </button>
          )}
        </div>
      )}

      {loanBalance > 0 && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "11px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>💰 Outstanding advance</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: "#b45309" }}>{fmt(loanBalance)}</span>
        </div>
      )}

      {lb && (
        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Leave balances (BCEA)</div>
          {[
            ["Annual", `${lb.annualBalance}d remaining`, `${lb.annualAccrued}d accrued`, lb.annualBalance === 0],
            ["Sick", `${lb.sickBalance}d remaining`, "30-day 3yr cycle", lb.sickBalance < 5],
            ["Family", `${lb.familyBalance}d remaining`, "3 days/year", lb.familyBalance === 0],
          ].map(([type, main, sub, warn]) => (
            <div key={type as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{type} leave</span>
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>{sub}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: warn ? "#be123c" : "#0369A1" }}>{main}</span>
            </div>
          ))}
        </div>
      )}

      {(staff.id_number ||
        staff.tax_number ||
        staff.contact_number ||
        staff.address ||
        staff.bank_name ||
        (!staff.is_contractor && (staff.employee_number || staff.date_of_birth))) && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "11px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Details</div>
          {!staff.is_contractor && staff.employee_number && <Row label="Employee no." value={staff.employee_number} />}
          {staff.id_number && <Row label="SA ID" value={staff.id_number} />}
          {staff.tax_number && <Row label="Tax ref" value={staff.tax_number} />}
          {!staff.is_contractor && staff.date_of_birth && <Row label="Date of birth" value={staff.date_of_birth} />}
          {staff.contact_number && <Row label="Contact" value={staff.contact_number} />}
          {staff.address && <Row label="Address" value={staff.address} />}
          {staff.bank_name && <Row label="Bank" value={staff.bank_account ? `${staff.bank_name} · ${staff.bank_account}` : staff.bank_name} />}
        </div>
      )}

      {staffPayRuns.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Pay history</div>
          {staffPayRuns.slice(0, 8).map((p) => (
            <div key={p.id} style={{ background: "#f8fafc", borderRadius: 12, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                  {p.pay_date} · {p.pay_period}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  Gross {fmt(p.gross_wages)}
                  {(p.paye ?? 0) > 0 ? ` · PAYE −${fmt(p.paye)}` : ""}
                  {(p.loan_deducted ?? 0) > 0 ? ` · Loan −${fmt(p.loan_deducted)}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{fmt(p.net_pay)}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>net</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Offboarding lives behind a collapse so the profile stays a profile until
          you actually need to end the employment. Employees only (contractors have
          no exit obligations), never once already terminated, and only when RLS
          would accept the write. */}
      {!staff.is_contractor && !isTerminated && access.canEdit && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowTerminate((p) => !p)}
            style={{ width: "100%", background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "11px 16px", display: "flex", justifyContent: "space-between", cursor: "pointer" }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>🚪 Mark as left / terminate</span>
            <span style={{ color: "#b45309" }}>{showTerminate ? "▲" : "▼"}</span>
          </button>
          {showTerminate && (
            <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: 14, marginTop: 10 }}>
              <Field label="Last day of employment">
                <Input type="date" value={termEnd} onChange={setTermEnd} />
              </Field>
              <Field label="Reason for leaving">
                <Chips options={TERM_REASONS} selected={termReason} onSelect={setTermReason} />
              </Field>
              <Field label="Notice worked?">
                <Chips options={["Yes", "No"]} selected={termNotice ? "Yes" : "No"} onSelect={(v) => v && setTermNotice(v === "Yes")} />
              </Field>

              <div style={{ background: "#fff", border: "1px solid #fed7aa", borderRadius: 10, padding: "11px 13px", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Final pay checklist</div>
                <div style={{ fontSize: 12, color: "#7c2d12", lineHeight: 1.6 }}>
                  • Accrued annual leave: <strong>{lb?.annualBalance ?? 0}d</strong>
                  {termMonths > 4 && (
                    <>
                      {" "}
                      — suggested payout <strong>{fmt(leavePayout)}</strong> ({lb?.annualBalance ?? 0}d × {fmt(dailyRate)}/day). BCEA s40: leave must be paid out for anyone employed longer than 4 months.
                    </>
                  )}
                </div>
                {!termNotice && (
                  <div style={{ fontSize: 12, color: "#7c2d12", lineHeight: 1.6, marginTop: 6 }}>
                    • Notice not worked — rough notice pay ≈ <strong>{fmt(dailyRate * 20)}</strong> (about one month).
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#7c2d12", lineHeight: 1.6, marginTop: 6 }}>• Run a final Pay Run, submit a UI-19, and issue a Certificate of Service.</div>
                <div style={{ fontSize: 11, color: "#b45309", lineHeight: 1.5, marginTop: 8, fontStyle: "italic" }}>
                  Worklog records the exit but doesn&apos;t compute the legal final amount — confirm the final figure with an accountant.
                </div>
              </div>

              <button
                onClick={handleTerminate}
                disabled={updateStaff.isPending}
                style={{ width: "100%", background: "#b45309", color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontSize: 13, fontWeight: 700, cursor: updateStaff.isPending ? "default" : "pointer", opacity: updateStaff.isPending ? 0.6 : 1 }}
              >
                {updateStaff.isPending ? "Saving..." : "Confirm — mark as left"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* The way to give someone a raise. Until now the register was write-once,
          so the only route was deleting them and typing them in again — losing
          their start date, ID and tax reference, and with them the leave accrual
          that start date drives.
          Absent for a view-only member: RLS would refuse the update anyway
          (0047 wants 'edit'), and a button that fails on save is worse than no
          button. */}
      {onEdit && (
      <button
        onClick={onEdit}
        style={{
          width: "100%",
          marginTop: 16,
          background: "#fff",
          border: "1.5px solid #BAE6FD",
          borderRadius: 12,
          padding: "12px",
          fontSize: 13,
          fontWeight: 700,
          color: "#0C4A6E",
          cursor: "pointer",
        }}
      >
        ✏️ Edit details
      </button>
      )}
    </Modal>
  );
}

export function StaffView() {
  const { data: staff, isLoading } = useStaffRegister();
  const updateStaff = useUpdateStaffMember();
  const { data: loans } = useWorkerLoans();
  const { data: leave } = useWorkerLeave();
  const { data: payRuns } = usePayRuns();
  const { data: business } = useBusinessProfile();
  const { data: currentMember } = useCurrentMember();
  // Keeps the UI honest about what RLS will accept — the same question every
  // other view asks before offering a write.
  const access = useToolAccess("staffregister");
  const [showAdd, setShowAdd] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "left">("all");
  const [typeFilter, setTypeFilter] = useState<WorkerTypeFilter>("all");
  const [sort, setSort] = useState<"az" | "recent">("az");

  const isOwner = (currentMember ?? { role: "owner" }).role === "owner";
  const plan = (business?.plan ?? "solo") as Plan;
  const staffCount = (staff ?? []).length;
  // The cap and its wording live in SOLO_RESTRICTED so the plan's limits are
  // defined in one place rather than duplicated across every gated view.
  const restriction = isRestricted(plan, "staffregister");
  const staffLimit = restriction?.limit;
  const soloCapped = staffLimit !== undefined && staffCount >= staffLimit;

  // Search (name, employee no., ID, contractor trading name), the status pills and
  // the worker-type pills narrow the list the same way the other list tools do.
  const all = staff ?? [];
  const anyTerminated = all.some((w) => w.terminated);
  // Only offer a type pill for a type someone actually is — a register of five
  // permanent employees doesn't need three empty filters. The row disappears
  // entirely below two types, where filtering can't tell you anything new.
  const presentTypes = WORKER_TYPES.filter((t) => all.some((w) => w.employment_type === t.value));
  const filtered = all.filter((w) => {
    if (statusFilter === "active" && w.terminated) return false;
    if (statusFilter === "left" && !w.terminated) return false;
    if (typeFilter !== "all" && w.employment_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${w.full_name} ${w.employee_number ?? ""} ${w.id_number ?? ""} ${w.trading_name ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  // Terminated staff always sink to the bottom — a final pay run may still be
  // owed — then the chosen sort orders each group: A–Z by name, or most recently
  // added first.
  const sortedStaff = [...filtered].sort((a, b) => {
    const term = (a.terminated ? 1 : 0) - (b.terminated ? 1 : 0);
    if (term !== 0) return term;
    return sort === "recent" ? (b.created_at ?? "").localeCompare(a.created_at ?? "") : a.full_name.localeCompare(b.full_name);
  });

  const handleAddClick = () => {
    if (soloCapped) setShowUpgrade(true);
    else setShowAdd(true);
  };

  // Removing someone typed in by mistake, the same soft delete the other list
  // tools use. Not the way to record a departure — that's "mark as left", which
  // keeps the person, their leave accrual and their exit details on file — so the
  // prompt points anyone who is here for that at the right door. Pay runs snapshot
  // the worker's name and figures, so pay history and payslips survive either way.
  const handleSoftDelete = (w: StaffMember) => {
    const stillEmployed = !w.terminated;
    if (
      !confirm(
        `Remove ${w.full_name} from the staff register?${stillEmployed ? "\n\nIf they have left, use “Mark as left / terminate” instead — that keeps their record and leave balance for the UI-19 and Certificate of Service." : ""}\n\nPast pay runs and payslips are unaffected.`
      )
    )
      return;
    updateStaff.mutate(
      { id: w.id, changes: { deleted_at: new Date().toISOString() } },
      { onError: (e) => alert(e instanceof Error ? e.message : "Couldn't remove this person.") }
    );
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Staff Register</h1>
        </div>
        <button
          onClick={handleAddClick}
          style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          {soloCapped ? "🔒 Add" : "+ Add"}
        </button>
      </div>

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && all.length === 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>No employees yet. Add your first one above.</div>
        </div>
      )}

      {!isLoading && all.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff..."
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", marginBottom: 12, background: "#fff" }}
        />
      )}

      {/* Status pills only appear once someone has left — until then everyone is
          active and a filter would be noise. */}
      {anyTerminated && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {(["all", "active", "left"] as const).map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`, background: active ? "#0C4A6E" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}
              >
                {s === "all" ? "All" : s === "active" ? "Active" : "Left"}
              </button>
            );
          })}
        </div>
      )}

      {/* Worker type sits on its own row under the status pills and stacks with
          them, so "left contractors" is two taps. Each pill carries its own count
          so the split is readable before you filter by it. */}
      {presentTypes.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {([{ value: "all", label: "All types" }, ...presentTypes] as { value: WorkerTypeFilter; label: string }[]).map((t) => {
            const active = typeFilter === t.value;
            const count = t.value === "all" ? all.length : all.filter((w) => w.employment_type === t.value).length;
            return (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`, background: active ? "#0C4A6E" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {t.label}{" "}
                <span style={{ fontWeight: 600, color: active ? "#7DD3FC" : "#94a3b8" }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && all.length > 0 && sortedStaff.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No staff match your search or filters.</p>
      )}

      {sortedStaff.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {sortedStaff.length}
            {sortedStaff.length !== all.length ? ` of ${all.length}` : ""} {all.length === 1 ? "person" : "people"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["az", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: sort === s ? "#fff" : "transparent", color: sort === s ? "#0C4A6E" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >
                {s === "az" ? "A–Z" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {sortedStaff.map((w) => {
        const staffLoans = (loans ?? []).filter((l) => l.staff_id === w.id);
        const staffLeave = (leave ?? []).filter((l) => l.staff_id === w.id);
        const staffPayRuns = (payRuns ?? []).filter((p) => p.staff_id === w.id);
        const loanBal = getLoanBalance(staffLoans);
        const leaveEntries = [
          ...staffLeave.map((l) => ({ leave_type: l.leave_type, days: l.days, date: l.start_date })),
          ...staffPayRuns.filter((p) => (p.leave_days ?? 0) > 0).map((p) => ({ leave_type: p.leave_type ?? "Annual", days: p.leave_days ?? 0, date: p.pay_date })),
        ];
        const lb = w.is_contractor ? null : calcLeaveBalances(w.start_date, leaveEntries);
        const lastWage = staffPayRuns[0];
        const rate = rateLabel(fmt, w.pay_type, w.daily_wage ?? 0, w.hourly_rate ?? 0, w.monthly_salary ?? 0);
        const badge = EMPLOYMENT_BADGE[w.employment_type];
        return (
          // Same shape as Customers: the card body opens the record, a ✕ on the
          // right removes it. The two are separate buttons so the delete can be
          // hidden for a member without delete rights without changing the row.
          <div
            key={w.id}
            style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 4, opacity: w.terminated ? 0.6 : 1 }}
          >
          <button
            onClick={() => setSelected(w)}
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
            aria-label={`Open ${w.full_name}`}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{w.full_name}</div>
                  {w.terminated && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" }}>🚪 Left</span>
                  )}
                  {badge && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: badge.bg, color: badge.fg, border: `1px solid ${badge.border}` }}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  {w.pay_type} · {rate}
                  {!w.is_contractor && ` · ${w.days_per_week}d/wk`}
                </div>
                {w.terminated ? (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    Left{w.term_end_date ? ` ${w.term_end_date}` : ""}
                    {w.term_reason ? ` · ${w.term_reason}` : ""}
                  </div>
                ) : (
                  w.contract_end_date && <div style={{ fontSize: 11, color: "#6d28d9", marginTop: 2 }}>Contract ends {w.contract_end_date}</div>
                )}
              </div>
              {/* No chevron here any more — the ✕ now occupies the row's right
                  edge, and two markers competing for it read as clutter. */}
              {loanBal > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fff7ed", padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap", marginLeft: 8 }}>
                  Loan {fmt(loanBal)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {lastWage && <span style={{ fontSize: 11, color: "#64748b", background: "#f8fafc", padding: "3px 8px", borderRadius: 8 }}>Last paid {lastWage.pay_date}</span>}
              {lb && (
                <span style={{ fontSize: 11, color: lb.annualBalance === 0 ? "#be123c" : "#0369A1", background: lb.annualBalance === 0 ? "#fff1f2" : "#F0F9FF", padding: "3px 8px", borderRadius: 8 }}>
                  Leave {lb.annualBalance}d
                </span>
              )}
              {w.is_contractor && <span style={{ fontSize: 11, color: "#92400e", background: "#fff7ed", padding: "3px 8px", borderRadius: 8 }}>No UIF / no leave</span>}
            </div>
          </button>
          {access.canDelete && (
            <button
              onClick={() => handleSoftDelete(w)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
              aria-label={`Remove ${w.full_name}`}
            >
              ✕
            </button>
          )}
          </div>
        );
      })}

      {restriction && staffLimit !== undefined && (
        <div style={{ background: soloCapped ? "#fff1f2" : "#F0F9FF", border: `1.5px solid ${soloCapped ? "#fecdd3" : "#BAE6FD"}`, borderRadius: 10, padding: "9px 12px", marginTop: 4, fontSize: 12, color: soloCapped ? "#be123c" : "#0369A1" }}>
          {soloCapped ? restriction.message : `${TIERS[plan].label} plan: ${staffCount}/${staffLimit} employees used.`}
        </div>
      )}

      {showAdd && <StaffModal onClose={() => setShowAdd(false)} />}
      {showUpgrade && business && (
        <UpgradeModal feature="staffregister" currentPlan={plan} isOwner={isOwner} onClose={() => setShowUpgrade(false)} />
      )}
      {selected && (
        <StaffDetailModal
          staff={selected}
          onClose={() => setSelected(null)}
          // Swap detail for edit rather than stacking one modal on another.
          // Null for a view-only member, so the button isn't there at all.
          onEdit={
            access.canEdit
              ? () => {
                  setEditing(selected);
                  setSelected(null);
                }
              : null
          }
        />
      )}
      {/* Keyed on the row's id so the form remounts — and therefore re-reads its
          initial state — if a different person is opened without unmounting. */}
      {editing && <StaffModal key={editing.id} staff={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
