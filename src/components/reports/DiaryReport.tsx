"use client";

import { useState } from "react";
import { useBookings } from "@/lib/supabase/hooks/useBookings";
import { aggregateDiary } from "@/lib/diaryReport";
import { buildDiaryReportHTML } from "@/lib/docgen/buildLedgerHTML";
import { fmt, todayStr } from "@/lib/format";
import { inPeriod, PERIOD_LABELS, type Period } from "@/lib/period";
import {
  ReportIntro,
  StatTiles,
  PeriodPicker,
  ReportGroupHeading,
  ReportRow,
  ReportActions,
  EmptyReport,
  asAtLabel,
} from "@/components/reports/ReportShell";

const STATUS_TONE: Record<string, string> = {
  complete: "#0369A1",
  confirmed: "#0C4A6E",
  pending: "#b45309",
  no_show: "#be123c",
  cancelled: "#64748b",
};

// The Diary tab of Scheduling Reports. The Diary itself is a calendar you work
// in; this is the month read back — what was booked, what actually happened, and
// what walked away.
export function DiaryReport() {
  const { data: bookings } = useBookings();
  const [period, setPeriod] = useState<Period>("month");

  const within = inPeriod(period);
  const all = bookings ?? [];
  const scoped = all.filter((b) => within(b.booking_date ?? ""));
  const { byStatus, clients, totals } = aggregateDiary(scoped);
  const periodLabel = PERIOD_LABELS[period];

  if (all.length === 0) return <EmptyReport>No appointments in the diary yet.</EmptyReport>;

  const pdfStatuses = byStatus.map((s) => ({ label: s.label, count: s.count, value: s.value, hours: s.hours }));
  const pdfClients = clients.map((c) => ({ name: c.name, appointments: c.appointments, value: c.value, noShows: c.noShows }));

  return (
    <>
      <ReportIntro>What was booked, what actually happened, and what walked away.</ReportIntro>

      <PeriodPicker period={period} onChange={setPeriod} options={["week", "month", "year", "all"]} />

      {scoped.length === 0 ? (
        <EmptyReport>No appointments in {periodLabel.toLowerCase()}.</EmptyReport>
      ) : (
        <>
          <StatTiles
            tiles={[
              { label: "Appointments", value: String(totals.appointments), tone: "sky" },
              { label: "Hours booked", value: `${totals.hours.toFixed(1)}h`, tone: "plain" },
              {
                label: "No-shows",
                value: `${totals.noShowRate.toFixed(0)}%`,
                tone: totals.noShowRate > 0 ? "bad" : "good",
              },
            ]}
          />

          <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Completed</div>
                <div style={{ fontSize: 10, color: "#7DD3FC", marginTop: 2 }}>Of {fmt(totals.booked)} booked</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", whiteSpace: "nowrap", marginLeft: 10 }}>{fmt(totals.completed)}</div>
            </div>
            {totals.lost > 0 && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#7DD3FC" }}>Lost to no-shows &amp; cancellations</span>
                <span style={{ color: "#F59E0B", fontWeight: 700 }}>{fmt(totals.lost)}</span>
              </div>
            )}
            {totals.deposits > 0 && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#7DD3FC" }}>Deposits taken</span>
                <span style={{ color: "#fff", fontWeight: 700 }}>{fmt(totals.deposits)}</span>
              </div>
            )}
            {totals.outstanding > 0 && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#7DD3FC" }}>Still to collect on completed work</span>
                <span style={{ color: "#F59E0B", fontWeight: 700 }}>{fmt(totals.outstanding)}</span>
              </div>
            )}
          </div>

          <ReportGroupHeading label="By status" right={`${totals.onsite} on-site · ${totals.inHouse} in-house`} />
          {byStatus.map((s) => (
            <ReportRow
              key={s.status}
              title={s.label}
              sub={`${s.count} appointment${s.count === 1 ? "" : "s"} · ${s.hours.toFixed(1)}h`}
              value={fmt(s.value)}
              valueColor={STATUS_TONE[s.status] ?? "#0C4A6E"}
            />
          ))}

          {clients.length > 0 && (
            <>
              <ReportGroupHeading label="By client" right={`${clients.length}`} />
              {clients.slice(0, 12).map((c) => (
                <ReportRow
                  key={c.name}
                  title={c.name}
                  sub={
                    <>
                      {c.appointments} appointment{c.appointments === 1 ? "" : "s"}
                      {c.noShows > 0 && <span style={{ color: "#be123c" }}> · {c.noShows} no-show{c.noShows === 1 ? "" : "s"}</span>}
                    </>
                  }
                  value={fmt(c.value)}
                />
              ))}
              {clients.length > 12 && (
                <div style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 8px 2px" }}>
                  + {clients.length - 12} more — all of them are in the PDF
                </div>
              )}
            </>
          )}

          <ReportActions
            filename="diary-report"
            pdf={() => ({ kind: "diaryreport", statuses: pdfStatuses, clients: pdfClients, totals, asAt: asAtLabel(), periodLabel })}
            fallbackHtml={(business, watermark) =>
              buildDiaryReportHTML(business, pdfStatuses, pdfClients, totals, asAtLabel(), watermark, periodLabel)
            }
            share={() => ({
              title: "Diary Report",
              subtitle: `${periodLabel} · as at ${todayStr()}`,
              lines: [
                `${totals.appointments} appointments · ${totals.hours.toFixed(1)}h booked`,
                `Booked ${fmt(totals.booked)} · completed ${fmt(totals.completed)}`,
                `No-shows ${totals.noShowRate.toFixed(0)}% · cancelled ${totals.cancelRate.toFixed(0)}%`,
                ``,
                ...byStatus.map((s) => `${s.label}: ${s.count} · ${fmt(s.value)}`),
              ],
            })}
          />
        </>
      )}
    </>
  );
}
