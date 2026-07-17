"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { useCreateStaffMember, useUpdateStaffMember, type StaffMember } from "@/lib/supabase/hooks/useStaffRegister";
import { useTaxRates } from "@/lib/taxRates";
import { fmt, todayStr } from "@/lib/format";

const EMPLOYMENT_TYPES = [
  { value: "permanent", icon: "👔", label: "Permanent employee", desc: "Works for you indefinitely. UIF, PAYE and leave all apply." },
  { value: "fixed_term", icon: "📅", label: "Fixed-term employee", desc: "Has a contract end date but is still an employee. UIF, PAYE and leave apply." },
  { value: "casual", icon: "🔁", label: "Casual / part-time worker", desc: "Works irregularly or part-time. Still an employee — UIF and leave apply from day 1." },
  { value: "contractor", icon: "🧾", label: "Independent contractor", desc: "Self-employed. Invoices you for work. No UIF, no PAYE, no leave — they handle their own tax." },
] as const;

type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];

/** The one rate field, read back out of whichever column the pay type uses. */
const rateOf = (s: StaffMember) => {
  const r = s.pay_type === "Hourly" ? s.hourly_rate : s.pay_type === "Monthly" ? s.monthly_salary : s.daily_wage;
  return r ? String(r) : "";
};

/**
 * Add a staff member, or edit one.
 *
 * Editing is safe in a way that isn't obvious: pay_runs snapshots worker_name,
 * base_rate and every computed figure at the moment it is created, so it never
 * reads back through here. Changing a wage moves future pay runs and leaves
 * every past one exactly as it was paid — which is the only correct answer, and
 * why this needs no effective-date table.
 *
 * Without it the only way to give someone a raise was to delete them and type
 * them in again, losing their start date, ID and tax reference in the process.
 */
export function StaffModal({ staff, onClose }: { staff?: StaffMember; onClose: () => void }) {
  const createStaffMember = useCreateStaffMember();
  const updateStaffMember = useUpdateStaffMember();
  const { PAYE_MONTHLY_THRESHOLD, calcUIF } = useTaxRates();
  const isEdit = !!staff;

  const [firstName, setFirstName] = useState(staff?.first_name ?? "");
  const [lastName, setLastName] = useState(staff?.last_name ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>((staff?.employment_type as EmploymentType) ?? "permanent");
  const [payType, setPayType] = useState(staff?.pay_type ?? "Daily");
  const [rate, setRate] = useState(staff ? rateOf(staff) : "");
  const [startDate, setStartDate] = useState(staff?.start_date ?? todayStr());
  const [contractEndDate, setContractEndDate] = useState(staff?.contract_end_date ?? "");
  const [tradingName, setTradingName] = useState(staff?.trading_name ?? "");
  const [idNumber, setIdNumber] = useState(staff?.id_number ?? "");
  const [taxNumber, setTaxNumber] = useState(staff?.tax_number ?? "");
  const [contactNumber, setContactNumber] = useState(staff?.contact_number ?? "");
  const [daysPerWeek, setDaysPerWeek] = useState(String(staff?.days_per_week ?? 5));
  const [hoursPerDay, setHoursPerDay] = useState(String(staff?.hours_per_day ?? 8));
  const [showExtras, setShowExtras] = useState(false);
  const [error, setError] = useState("");

  const daysPerMonth = parseFloat(daysPerWeek || "5") * 4.33;
  const hoursPerMonth = daysPerMonth * parseFloat(hoursPerDay || "8");
  const rateNum = parseFloat(rate || "0");
  const estimatedMonthly = payType === "Daily" ? rateNum * daysPerMonth : payType === "Hourly" ? rateNum * hoursPerMonth : rateNum;
  const isContractor = employmentType === "contractor";

  // Preview the same way the Pay Run will actually calculate. This used to
  // hardcode 2% of the full wage, which ignored the UIF ceiling — so anyone
  // above it was quoted more UIF here than Pay Run would ever deduct, and the
  // PAYE threshold was a literal that would drift the next time SARS moved it.
  const uifPreview = calcUIF(estimatedMonthly);
  const payeApplies = estimatedMonthly > PAYE_MONTHLY_THRESHOLD;

  // The one edit the app can't make safe on its own. Past pay runs keep their
  // snapshot either way, so nothing already paid moves — but reclassifying
  // someone between employee and contractor part-way through a tax year changes
  // what SARS is owed and expects, and that conversation is with SARS, not us.
  const reclassifying = isEdit && staff.is_contractor !== isContractor;

  const saving = createStaffMember.isPending || updateStaffMember.isPending;

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim() || !rate) {
      setError("Enter a first name, last name and rate.");
      return;
    }
    setError("");

    const values = {
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      employment_type: employmentType,
      is_contractor: isContractor,
      trading_name: isContractor ? tradingName.trim() || null : null,
      id_number: idNumber || null,
      tax_number: !isContractor ? taxNumber || null : null,
      contact_number: contactNumber || null,
      start_date: !isContractor ? startDate : null,
      contract_end_date: employmentType === "fixed_term" ? contractEndDate || null : null,
      pay_type: payType,
      daily_wage: payType === "Daily" ? rateNum : 0,
      hourly_rate: payType === "Hourly" ? rateNum : 0,
      monthly_salary: payType === "Monthly" ? rateNum : 0,
      days_per_week: parseFloat(daysPerWeek || "5"),
      hours_per_day: parseFloat(hoursPerDay || "8"),
    };

    const handlers = {
      onSuccess: () => onClose(),
      onError: (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't save."),
    };

    if (isEdit) updateStaffMember.mutate({ id: staff.id, changes: values }, handlers);
    else createStaffMember.mutate(values, handlers);
  };

  return (
    <Modal title={isEdit ? `Edit ${staff.first_name || "staff member"}` : "Add Staff Member"} onClose={onClose}>
      {isEdit && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: "#0369A1", lineHeight: 1.6 }}>
          Changes apply to pay runs from here on. Everything you have already paid keeps the rate it was paid at.
        </div>
      )}

      {reclassifying && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700 }}>⚠️ You&apos;re changing {staff.first_name || "this person"} from a{staff.is_contractor ? " contractor to an employee" : "n employee to a contractor"}.</span>{" "}
          {staff.is_contractor
            ? "From now on their pay will have PAYE and UIF deducted, and leave will accrue."
            : "From now on there will be no PAYE, no UIF and no leave — they invoice you and handle their own tax."}{" "}
          Past pay runs are untouched. Mid-tax-year changes affect your EMP201 and their IRP5, so check with your accountant or SARS first.
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>What type of worker is this?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EMPLOYMENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setEmploymentType(t.value)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                border: `2px solid ${employmentType === t.value ? "#0C4A6E" : "#e2e8f0"}`,
                borderRadius: 12,
                background: employmentType === t.value ? "#F0F9FF" : "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: employmentType === t.value ? "#0C4A6E" : "#111" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.5 }}>{t.desc}</div>
              </div>
              {employmentType === t.value && <span style={{ marginLeft: "auto", color: "#0C4A6E", fontSize: 16, flexShrink: 0 }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {isContractor && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700 }}>🧾 Independent contractor</span> — You pay them an agreed amount and they invoice you. Log their payment as an <strong>expense</strong> under &quot;Subcontractor / contract labour.&quot; They handle their own UIF and tax. No leave tracking needed.
        </div>
      )}

      {employmentType === "fixed_term" && (
        <Field label="Contract end date">
          <Input type="date" value={contractEndDate} onChange={setContractEndDate} />
        </Field>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="First name">
          <Input value={firstName} onChange={setFirstName} placeholder="e.g. Sipho" />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={setLastName} placeholder="e.g. Dlamini" />
        </Field>
      </div>

      <Field label="Pay type">
        <Chips options={["Daily", "Hourly", "Monthly"]} selected={payType} onSelect={(v) => v && setPayType(v)} />
      </Field>

      <Field label={payType === "Daily" ? "Daily wage / rate (R)" : payType === "Hourly" ? "Hourly rate (R)" : "Monthly salary / fee (R)"}>
        <Input
          type="number"
          value={rate}
          onChange={setRate}
          placeholder={payType === "Daily" ? "e.g. 350" : payType === "Hourly" ? "e.g. 75" : "e.g. 8 500"}
        />
      </Field>

      {!isContractor && (
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={setStartDate} />
        </Field>
      )}

      {estimatedMonthly > 0 && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#0369A1", fontWeight: 600 }}>
              Est. {payType === "Daily" ? `${daysPerMonth.toFixed(0)} days` : payType === "Hourly" ? `${hoursPerMonth.toFixed(0)}h` : "monthly"}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#0C4A6E" }}>{fmt(estimatedMonthly)}</span>
          </div>
          {isContractor ? (
            <div style={{ fontSize: 11, color: "#0369A1" }}>🧾 Log as expense when you pay them — no PAYE, UIF or leave required</div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: payeApplies ? "#b45309" : "#0369A1", marginBottom: 3 }}>
                {`UIF: ${fmt(uifPreview.total)}/mo (employee ${fmt(uifPreview.employee)} + employer ${fmt(uifPreview.employer)})`}
              </div>
              <div style={{ fontSize: 11, color: payeApplies ? "#b45309" : "#0369A1" }}>
                {payeApplies
                  ? "⚠️ PAYE will apply — calculated in Pay Run"
                  : `✅ Below PAYE threshold (${fmt(PAYE_MONTHLY_THRESHOLD)}/mo)`}
              </div>
              {employmentType === "casual" && (
                <div style={{ fontSize: 11, color: "#0369A1", marginTop: 3 }}>ℹ️ Casual workers: UIF and leave apply from day 1 even for short engagements</div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setShowExtras((p) => !p)}
        style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "11px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", cursor: "pointer" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>More details (optional)</span>
        <span style={{ color: "#94a3b8" }}>{showExtras ? "▲" : "▼"}</span>
      </button>
      {showExtras && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          {!isContractor && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Days/week">
                <Input type="number" value={daysPerWeek} onChange={setDaysPerWeek} placeholder="5" />
              </Field>
              {payType === "Hourly" && (
                <Field label="Hours/day">
                  <Input type="number" value={hoursPerDay} onChange={setHoursPerDay} placeholder="8" />
                </Field>
              )}
            </div>
          )}
          <Field label="SA ID number">
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "7px 10px", marginBottom: 6, fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
              🔒 <span style={{ fontWeight: 700 }}>POPIA:</span> By entering this employee&apos;s ID number, you confirm they have been informed their personal data is being stored and processed.
            </div>
            <Input type="tel" value={idNumber} onChange={(v) => setIdNumber(v.replace(/\D/g, "").slice(0, 13))} placeholder="13-digit ID" />
            {idNumber.length > 0 && idNumber.length < 13 && <div style={{ fontSize: 11, color: "#b45309", marginTop: 2 }}>{13 - idNumber.length} more digits</div>}
          </Field>
          {!isContractor && (
            <Field label="Tax reference (IRP5)">
              <Input value={taxNumber} onChange={setTaxNumber} placeholder="From SARS eFiling" />
            </Field>
          )}
          <Field label="Contact number">
            <Input type="tel" value={contactNumber} onChange={setContactNumber} placeholder="082 123 4567" />
          </Field>
          {isContractor && (
            <Field label="Their business / trading name (optional)">
              <Input value={tradingName} onChange={setTradingName} placeholder="e.g. ABC Plumbing cc" />
            </Field>
          )}
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn
        label={saving ? "Saving..." : isEdit ? "Save changes" : isContractor ? "Save Contractor" : "Save Employee"}
        icon="👤"
        onClick={handleSave}
        disabled={saving}
      />
    </Modal>
  );
}
