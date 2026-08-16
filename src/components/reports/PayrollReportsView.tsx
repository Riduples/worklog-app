"use client";

import { useState } from "react";
import { StaffRegisterReport } from "@/components/reports/StaffRegisterReport";
import { AdvancesReport } from "@/components/reports/AdvancesReport";
import { LeaveReport } from "@/components/reports/LeaveReport";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

type Tab = "staff" | "advances" | "leave";

// Payroll Reports — one Payroll tool holding the three summaries a boss asks for:
// who is on the books, what has been advanced and is still owed, and where every
// employee's leave stands. The dashboards are for keeping the records; this is
// for reading them back, printing them, or sending them to the accountant.
export function PayrollReportsView() {
  // Each tab reads a different tool, and RLS would return nothing for one the
  // member can't view — an empty report reads as "no data" rather than "not
  // yours", so the tab is simply absent instead.
  const staffAccess = useToolAccess("staffregister");
  const advancesAccess = useToolAccess("advances");
  const leaveAccess = useToolAccess("leave");

  const tabs = [
    { id: "staff" as const, label: "👤 Staff", allowed: staffAccess.canView },
    { id: "advances" as const, label: "💰 Advances", allowed: advancesAccess.canView },
    { id: "leave" as const, label: "🏖️ Leave", allowed: leaveAccess.canView },
  ].filter((t) => t.allowed);

  // Default to the first tab this member can actually see, and follow it if the
  // access verdict arrives after the first render.
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab: Tab | null = picked && tabs.some((t) => t.id === picked) ? picked : tabs[0]?.id ?? null;

  const loading = staffAccess.loading || advancesAccess.loading || leaveAccess.loading;

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 16px" }}>Payroll Reports</h1>

      {tabs.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setPicked(t.id)}
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
      )}

      {loading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!loading && tab === null && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>
          You don&apos;t have access to any of the payroll tools these reports read.
        </p>
      )}
      {tab === "staff" && <StaffRegisterReport />}
      {tab === "advances" && <AdvancesReport />}
      {tab === "leave" && <LeaveReport />}
    </div>
  );
}
