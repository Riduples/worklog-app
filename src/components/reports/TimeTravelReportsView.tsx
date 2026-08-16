"use client";

import { HoursVsEstimateReport } from "@/components/time/HoursVsEstimateReport";
import { TravelReport } from "@/components/mileage/TravelReport";
import { DiaryReport } from "@/components/reports/DiaryReport";
import { ReportsTool } from "@/components/reports/ReportShell";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";

// Scheduling Reports — one tool over the three Scheduling dashboards: what the
// diary did, hours logged against hours quoted, and business travel for SARS.
// The Diary was the last dashboard in the app with no report behind it.
//
// The route is still /time-travel-reports: renaming it would break anyone's
// bookmark for nothing, and the tool's name is what users read.
export function TimeTravelReportsView() {
  const booking = useToolAccess("booking");
  const time = useToolAccess("timetrack");
  const mileage = useToolAccess("mileage");

  return (
    <ReportsTool
      title="Scheduling Reports"
      loading={booking.loading || time.loading || mileage.loading}
      tabs={[
        { id: "diary", label: "📅 Diary", show: booking.canView, render: () => <DiaryReport /> },
        { id: "hours", label: "⏱️ Hours vs Estimate", show: time.canView, render: () => <HoursVsEstimateReport /> },
        { id: "travel", label: "🚗 Travel", show: mileage.canView, render: () => <TravelReport /> },
      ]}
    />
  );
}
