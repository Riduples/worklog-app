"use client";

import { useState } from "react";
import { useStaffRegister, type StaffMember } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLoans } from "@/lib/supabase/hooks/useWorkerLoans";
import { useWorkerLeave } from "@/lib/supabase/hooks/useWorkerLeave";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { StaffModal } from "@/components/modals/StaffModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { fmt } from "@/lib/format";
import { calcLeaveBalances, getLoanBalance, rateLabel } from "@/lib/payroll";
import { isRestricted, TIERS, type Plan } from "@/lib/tiers";
import { BackLink } from "@/components/ui/BackLink";

const EMPLOYMENT_BADGE: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  contractor: { label: "🧾 Contractor", bg: "#fff7ed", fg: "#92400e", border: "#fed7aa" },
  fixed_term: { label: "📅 Fixed-term", bg: "#f5f3ff", fg: "#6d28d9", border: "#ddd6fe" },
  casual: { label: "🔁 Casual", bg: "#F0F9FF", fg: "#0369A1", border: "#BAE6FD" },
};

function StaffDetailModal({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const { data: loans } = useWorkerLoans();
  const { data: leave } = useWorkerLeave();
  const { data: payRuns } = usePayRuns();

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

      {(staff.id_number || staff.contact_number || staff.tax_number) && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "11px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Details</div>
          {staff.id_number && <Row label="SA ID" value={staff.id_number} />}
          {staff.tax_number && <Row label="Tax ref" value={staff.tax_number} />}
          {staff.contact_number && <Row label="Contact" value={staff.contact_number} />}
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
    </Modal>
  );
}

export function StaffView() {
  const { data: staff, isLoading } = useStaffRegister();
  const { data: loans } = useWorkerLoans();
  const { data: leave } = useWorkerLeave();
  const { data: payRuns } = usePayRuns();
  const { data: business } = useBusinessProfile();
  const { data: currentMember } = useCurrentMember();
  const [showAdd, setShowAdd] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);

  const isOwner = (currentMember ?? { role: "owner" }).role === "owner";
  const plan = (business?.plan ?? "shoebox") as Plan;
  const staffCount = (staff ?? []).length;
  // The cap and its wording live in SOLO_RESTRICTED so the plan's limits are
  // defined in one place rather than duplicated across every gated view.
  const restriction = isRestricted(plan, "staffregister");
  const staffLimit = restriction?.limit;
  const soloCapped = staffLimit !== undefined && staffCount >= staffLimit;

  const handleAddClick = () => {
    if (soloCapped) setShowUpgrade(true);
    else setShowAdd(true);
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

      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700 }}>👤 Staff Register</span> — Register each employee once. Their rate auto-loads in Pay Run. Leave balances track automatically from their start date.
      </div>

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (staff ?? []).length === 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>No employees yet. Add your first one below.</div>
        </div>
      )}

      {(staff ?? []).map((w) => {
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
          <button
            key={w.id}
            onClick={() => setSelected(w)}
            style={{ width: "100%", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{w.full_name}</div>
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
                {w.contract_end_date && <div style={{ fontSize: 11, color: "#6d28d9", marginTop: 2 }}>Contract ends {w.contract_end_date}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                {loanBal > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fff7ed", padding: "2px 8px", borderRadius: 8 }}>Loan {fmt(loanBal)}</span>}
                <span style={{ fontSize: 16, color: "#94a3b8" }}>›</span>
              </div>
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
      {selected && <StaffDetailModal staff={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
