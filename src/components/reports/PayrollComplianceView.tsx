"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { useTaxRates } from "@/lib/taxRates";
import { calcETI, monthsEmployedFrom } from "@/lib/eti";
import { fmt } from "@/lib/format";
import { isLocked, type Plan } from "@/lib/tiers";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { BackLink } from "@/components/ui/BackLink";
import { Emp201View } from "@/components/reports/Emp201View";
import { Uif201View } from "@/components/reports/Uif201View";
import { Emp501View } from "@/components/reports/Emp501View";
import { CoidaView } from "@/components/reports/CoidaView";

// Every payroll return in one place, as tabs — the same shape as the Reports
// tools. The individual EMP201 / UIF / EMP501 / COIDA screens render here as tab
// panels (embedded), so there's one home for them rather than a scattered list of
// links. Overview carries the month's payable-to-SARS summary; the rest are the
// working returns.
const TABS = [
  { id: "overview", label: "📋 Overview" },
  { id: "emp201", label: "👷 EMP201" },
  { id: "uif", label: "🛡️ UIF" },
  { id: "emp501", label: "🔁 EMP501" },
  { id: "coida", label: "🏭 COIDA" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// One row in the Overview's returns list — a button that jumps to that return's
// tab. Hoisted to module scope so it isn't re-created on every render.
function ReturnRow({ title, sub, right, border = true, onOpen }: { title: string; sub: string; right?: React.ReactNode; border?: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", width: "100%", background: "none", border: "none", borderBottom: border ? "1px solid #f1f5f9" : "none", cursor: "pointer", textAlign: "left" }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{title}</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {right}
        <span style={{ fontSize: 12, color: "#0369A1", fontWeight: 600 }}>Open →</span>
      </div>
    </button>
  );
}

export function PayrollComplianceView() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : "overview");
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: payRuns } = usePayRuns();
  const { data: currentMember } = useCurrentMember();
  const { SDL_ANNUAL_THRESHOLD } = useTaxRates();

  const plan = (business?.plan ?? "solo") as Plan;
  const isOwner = (currentMember?.role ?? "owner") === "owner";
  // EMP201 is a Structured tool; the rest of the hub is Trade. So the EMP201 tab
  // stays gated to its own plan — a Trade user sees the upgrade prompt on it,
  // exactly as they would have hitting the standalone /emp201.
  const emp201Locked = isLocked(plan, "emp201");

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = now.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const year = String(now.getFullYear());

  const runs = payRuns ?? [];
  const staffList = staff ?? [];
  const monthRuns = runs.filter((p) => p.pay_date.startsWith(monthKey));

  const paye = monthRuns.reduce((s, p) => s + Number(p.paye ?? 0), 0);
  const uif = monthRuns.reduce((s, p) => s + Number(p.uif_employee ?? 0) + Number(p.uif_employer ?? 0), 0);
  const sdl = monthRuns.reduce((s, p) => s + Number(p.sdl ?? 0), 0);
  const monthWages = monthRuns.reduce((s, p) => s + Number(p.gross_wages ?? 0), 0);

  const etiRaw = monthRuns.reduce((s, p) => {
    const worker = staffList.find((w) => w.id === p.staff_id);
    if (!worker) return s;
    const e = calcETI(worker, Number(p.gross_wages ?? 0), monthsEmployedFrom(worker.start_date));
    return s + (e.eligible ? e.amount : 0);
  }, 0);
  const eti = Math.min(etiRaw, paye);
  const payableToSars = Math.max(0, paye - eti) + uif + sdl;

  const coidaEarnings = runs.filter((p) => p.pay_date.startsWith(year)).reduce((s, p) => s + Number(p.gross_wages ?? 0), 0);
  const annualisedWages = monthWages * 12;
  const sdlNudge = !business?.sdl_registered && annualisedWages > SDL_ANNUAL_THRESHOLD;
  const hasPayroll = staffList.length > 0 || runs.length > 0;

  const card: React.CSSProperties = { background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", marginBottom: 12 };
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" };

  const overview = (
    <>
      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16, lineHeight: 1.5 }}>
        Your payroll returns in one place. Figures are estimates to confirm with your accountant — filing happens on the SARS &amp; Labour portals.
      </p>

      {!hasPayroll ? (
        <div style={{ ...card, textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>No payroll yet</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Add employees in the <Link href="/staff" style={{ color: "#0369A1", fontWeight: 600 }}>Staff Register</Link> and run a{" "}
            <Link href="/payroll" style={{ color: "#0369A1", fontWeight: 600 }}>Pay Run</Link> — this page then tracks what you owe SARS and Labour.
          </div>
        </div>
      ) : (
        <>
          <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Payable to SARS · {monthLabel}</div>
            <div style={{ ...rowStyle }}>
              <span style={{ fontSize: 13, color: "#7DD3FC" }}>PAYE</span>
              <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{fmt(paye)}</span>
            </div>
            {eti > 0 && (
              <div style={{ ...rowStyle }}>
                <span style={{ fontSize: 13, color: "#7DD3FC" }}>Less: ETI claimed</span>
                <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>−{fmt(eti)}</span>
              </div>
            )}
            <div style={{ ...rowStyle }}>
              <span style={{ fontSize: 13, color: "#7DD3FC" }}>UIF (employee + employer)</span>
              <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{fmt(uif)}</span>
            </div>
            {sdl > 0 && (
              <div style={{ ...rowStyle }}>
                <span style={{ fontSize: 13, color: "#7DD3FC" }}>SDL</span>
                <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{fmt(sdl)}</span>
              </div>
            )}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "#38BDF8", fontWeight: 700 }}>Total payable</span>
              <span style={{ fontSize: 22, color: "#fff", fontWeight: 900 }}>{fmt(payableToSars)}</span>
            </div>
            <button
              onClick={() => setTab("emp201")}
              style={{ width: "100%", marginTop: 12, background: "#38BDF8", color: "#0C4A6E", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Open EMP201 →
            </button>
          </div>

          {sdlNudge && (
            <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
              ⚠️ <strong>SDL may now apply.</strong> Your payroll annualises above {fmt(SDL_ANNUAL_THRESHOLD)} but SDL isn&apos;t registered. Check with your accountant, then switch SDL on in{" "}
              <Link href="/business" style={{ color: "#92400e", fontWeight: 700 }}>
                Business Details
              </Link>
              .
            </div>
          )}

          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Returns &amp; declarations</div>
            <ReturnRow onOpen={() => setTab("emp201")} title="EMP201 — monthly" sub="PAYE, UIF & SDL · due by the 7th of next month" />
            <ReturnRow onOpen={() => setTab("uif")} title="UIF declaration — monthly" sub="uFiling · plus a UI-19 whenever someone joins or leaves" />
            <ReturnRow onOpen={() => setTab("emp501")} title="EMP501 — reconciliation" sub="Reconciles your EMP201s · interim 31 Oct, annual 31 May (e@syFile)" />
            <ReturnRow
              onOpen={() => setTab("coida")}
              title="COIDA — Return of Earnings"
              sub={`Annual (CompEasy) · gross wages in ${year}, before the OID cap`}
              right={<span style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E" }}>{fmt(coidaEarnings)}</span>}
              border={false}
            />
          </div>

          <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
            Worklog surfaces these figures — it doesn&apos;t file for you. For CIPC, POPIA and every other obligation, see the{" "}
            <Link href="/compliance" style={{ color: "#0369A1", fontWeight: 600 }}>
              Compliance Dashboard
            </Link>
            .
          </p>
        </>
      )}
    </>
  );

  const emp201Panel = emp201Locked ? (
    <div style={{ ...card, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0C4A6E", marginBottom: 4 }}>EMP201 is a Structured feature</div>
      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 12 }}>
        The full monthly EMP201 working — PAYE, UIF, SDL and ETI, with a filing record — is included on the Structured plan.
      </div>
      <button
        onClick={() => setShowUpgrade(true)}
        style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        See Structured
      </button>
    </div>
  ) : (
    <Emp201View embedded />
  );

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 16px" }}>Payroll Compliance</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 20,
              border: `1.5px solid ${tab === t.id ? "#0C4A6E" : "#e2e8f0"}`,
              background: tab === t.id ? "#0C4A6E" : "#fff",
              color: tab === t.id ? "#fff" : "#374151",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && overview}
      {tab === "emp201" && emp201Panel}
      {tab === "uif" && <Uif201View embedded />}
      {tab === "emp501" && <Emp501View embedded />}
      {tab === "coida" && <CoidaView embedded />}

      {showUpgrade && business && (
        <UpgradeModal feature="emp201" currentPlan={plan} isOwner={isOwner} onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}
