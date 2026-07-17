"use client";

import { useState } from "react";
import Link from "next/link";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useTaxFilings } from "@/lib/supabase/hooks/useTaxFilings";
import { buildObligations, STATUS_STYLE } from "@/lib/compliance";
import type { Plan } from "@/lib/tiers";

type Filter = "all" | "worklog" | "external" | "employees";

export function ComplianceView() {
  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: income } = useIncome();
  const { data: filings } = useTaxFilings();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const employeeCount = (staff ?? []).length;
  const obligations = buildObligations({
    hasVat: !!business?.vat_number,
    hasPaye: !!business?.paye_ref,
    hasEmployees: employeeCount > 0,
    employeeCount,
    annualIncome: (income ?? []).reduce((s, r) => s + Number(r.amount), 0),
    lastVat201Date: (filings ?? []).find((f) => f.filing_type === "vat201")?.filed_date ?? null,
    lastEmp201Date: (filings ?? []).find((f) => f.filing_type === "emp201")?.filed_date ?? null,
  });

  const filtered =
    filter === "worklog"
      ? obligations.filter((o) => o.where === "worklog")
      : filter === "external"
        ? obligations.filter((o) => o.where !== "worklog")
        : filter === "employees"
          ? obligations.filter((o) => ["emp201", "uif", "coida_roe", "coida_logs"].includes(o.id))
          : obligations;

  const groups = [...new Set(obligations.map((o) => o.group))];
  const count = (s: string) => obligations.filter((o) => o.status === s).length;
  const plan = (business?.plan ?? "shoebox") as Plan;

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Link href="/tax" style={{ fontSize: 12, color: "#64748b" }}>
        ← Tax &amp; Compliance
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Compliance Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { label: "WORKLOG tools ready", val: count("ready"), s: STATUS_STYLE.ready },
          { label: "Action needed", val: count("action"), s: STATUS_STYLE.action },
          { label: "Requires registration", val: count("register"), s: STATUS_STYLE.register },
        ].map((c) => (
          <div key={c.label} style={{ background: c.s.bg, border: `1.5px solid ${c.s.border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.s.color }}>{c.val}</div>
            <div style={{ fontSize: 10, color: c.s.color, marginTop: 2, fontWeight: 600, lineHeight: 1.3 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 12, color: "#38BDF8", lineHeight: 1.6 }}>
        <span style={{ fontWeight: 700, color: "#fff" }}>Your business profile: </span>
        {business?.vat_number ? "VAT registered · " : "Not VAT registered · "}
        {employeeCount > 0 ? `${employeeCount} employee${employeeCount !== 1 ? "s" : ""} · ` : "No employees · "}
        {business?.sdl_registered ? "SDL registered · " : "SDL not registered · "}
        <span style={{ textTransform: "capitalize" }}>{plan} plan</span>
        {!business?.vat_number && !business?.paye_ref && employeeCount === 0 && (
          <span style={{ color: "#FDE68A" }}>
            {" "}
            —{" "}
            <Link href="/tax" style={{ color: "#FDE68A", fontWeight: 700 }}>
              Set up Business Details
            </Link>{" "}
            to get personalised status.
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {(
          [
            ["all", "All obligations"],
            ["worklog", "In WORKLOG"],
            ["external", "External"],
            ["employees", "Payroll & Labour"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${filter === v ? "#0C4A6E" : "#e2e8f0"}`, background: filter === v ? "#0C4A6E" : "#fff", color: filter === v ? "#fff" : "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            {l}
          </button>
        ))}
      </div>

      {groups.map((group) => {
        const items = filtered.filter((o) => o.group === group);
        if (!items.length) return null;
        return (
          <div key={group} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>{group}</div>
            {items.map((o) => {
              const s = STATUS_STYLE[o.status];
              const isOpen = expanded === o.id;
              return (
                <div key={o.id} style={{ background: "#fff", border: `1.5px solid ${isOpen ? s.border : "#e2e8f0"}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{o.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{o.title}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {o.freq} · Due: {o.due}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: "2px 7px", borderRadius: 6 }}>
                        {o.where === "worklog" ? "In WORKLOG" : o.where === "accountant" ? "Accountant" : "External"}
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{isOpen ? "▲" : "▾"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${s.border}` }}>
                      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.7, marginTop: 10, marginBottom: 12 }}>{o.note}</div>
                      {o.where === "worklog" && o.href ? (
                        <Link
                          href={o.href}
                          style={{ display: "inline-block", background: "#0C4A6E", border: "none", borderRadius: 10, padding: "10px 18px", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
                        >
                          → {o.cta}
                        </Link>
                      ) : (
                        <a
                          href={o.ctaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-block", background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10, padding: "10px 18px", color: "#0C4A6E", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
                        >
                          ↗ {o.cta}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#64748b", lineHeight: 1.7, marginTop: 4 }}>
        💡 WORKLOG handles VAT201, EMP201 and Provisional Tax estimation. All other obligations require eFiling, uFiling, CompEasy, BizPortal or your accountant. Deadlines shown are for the current period — set calendar reminders for each.
      </div>
    </div>
  );
}
