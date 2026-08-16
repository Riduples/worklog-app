"use client";

import { StaffRegisterReport } from "@/components/reports/StaffRegisterReport";
import { AdvancesReport } from "@/components/reports/AdvancesReport";
import { LeaveReport } from "@/components/reports/LeaveReport";
import { ReportsTool } from "@/components/reports/ReportShell";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";

// Payroll Reports — one Payroll tool holding the three summaries a boss asks for:
// who is on the books, what has been advanced and is still owed, and where every
// employee's leave stands. The dashboards are for keeping the records; this is
// for reading them back, printing them, or sending them to the accountant.
export function PayrollReportsView() {
  const staff = useToolAccess("staffregister");
  const advances = useToolAccess("advances");
  const leave = useToolAccess("leave");

  return (
    <ReportsTool
      title="Payroll Reports"
      loading={staff.loading || advances.loading || leave.loading}
      tabs={[
        { id: "staff", label: "👤 Staff", show: staff.canView, render: () => <StaffRegisterReport /> },
        { id: "advances", label: "💰 Advances", show: advances.canView, render: () => <AdvancesReport /> },
        { id: "leave", label: "🏖️ Leave", show: leave.canView, render: () => <LeaveReport /> },
      ]}
    />
  );
}
