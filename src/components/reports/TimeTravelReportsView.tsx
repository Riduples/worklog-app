"use client";

import { useState } from "react";
import { HoursVsEstimateReport } from "@/components/time/HoursVsEstimateReport";
import { TravelReport } from "@/components/mileage/TravelReport";
import { BackLink } from "@/components/ui/BackLink";

type Tab = "hours" | "travel";

// Time & Travel Reports — one Scheduling tool holding the two summaries: hours
// logged vs quoted (from the Time Log) and business travel (from the Travel Log).
export function TimeTravelReportsView() {
  const [tab, setTab] = useState<Tab>("hours");

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        padding: "8px 14px",
        borderRadius: 20,
        border: `1.5px solid ${tab === id ? "#0C4A6E" : "#e2e8f0"}`,
        background: tab === id ? "#0C4A6E" : "#fff",
        color: tab === id ? "#fff" : "#374151",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 16px" }}>Time &amp; Travel Reports</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabBtn("hours", "⏱️ Hours vs Estimate")}
        {tabBtn("travel", "🚗 Travel")}
      </div>

      {tab === "hours" ? <HoursVsEstimateReport /> : <TravelReport />}
    </div>
  );
}
