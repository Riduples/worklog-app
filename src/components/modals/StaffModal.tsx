"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { useCreateStaffMember } from "@/lib/supabase/hooks/useStaffRegister";
import { useTaxRates } from "@/lib/taxRates";
import { fmt, todayStr } from "@/lib/format";

const EMPLOYMENT_TYPES = [
  { value: "permanent", icon: "👔", label: "Permanent employee", desc: "Works for you indefinitely. UIF, PAYE and leave all apply." },
  { value: "fixed_term", icon: "📅", label: "Fixed-term employee", desc: "Has a contract end date but is still an employee. UIF, PAYE and leave apply." },
  { value: "casual", icon: "🔁", label: "Casual / part-time worker", desc: "Works irregularly or part-time. Still an employee — UIF and leave apply from day 1." },
  { value: "contractor", icon: "🧾", label: "Independent contractor", desc: "Self-employed. Invoices you for work. No UIF, no PAYE, no leave — they handle their own tax." },
] as const;

type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];

export function StaffModal({ onClose }: { onClose: () => void }) {
  const createStaffMember = useCreateStaffMember();
  const { PAYE_MONTHLY_THRESHOLD, calcUIF } = useTaxRates();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("permanent");
  const [payType, setPayType] = useState("Daily");
  const [rate, setRate] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [contractEndDate, setContractEndDate] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("5");
  const [hoursPerDay, setHoursPerDay] = useState("8");
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

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim() || !rate) {
      setError("Enter a first name, last name and rate.");
      return;
    }
    setError("");
    createStaffMember.mutate(
      {
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
      },
      {
        onSuccess: () => onClose(),
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save."),
      }
    );
  };

  return (
    <Modal title="Add Staff Member" onClose={onClose}>
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
        label={createStaffMember.isPending ? "Saving..." : isContractor ? "Save Contractor" : "Save Employee"}
        icon="👤"
        onClick={handleSave}
        disabled={createStaffMember.isPending}
      />
    </Modal>
  );
}
