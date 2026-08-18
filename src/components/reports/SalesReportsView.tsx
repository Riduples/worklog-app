"use client";

import { useState } from "react";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { useCreditNotes } from "@/lib/supabase/hooks/useCreditNotes";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import {
  aggregateQuoteConversion,
  aggregateRecurring,
  aggregateSalesSummary,
  aggregateWhatSells,
} from "@/lib/salesReports";
import {
  buildQuoteConversionHTML,
  buildRecurringRevenueHTML,
  buildSalesSummaryHTML,
  buildWhatSellsHTML,
} from "@/lib/docgen/buildLedgerHTML";
import { fmt, todayStr } from "@/lib/format";
import { inPeriod, PERIOD_LABELS, type Period } from "@/lib/period";
import {
  ReportsTool,
  ReportIntro,
  StatTiles,
  PeriodPicker,
  ReportGroupHeading,
  ReportRow,
  ReportActions,
  EmptyReport,
  asAtLabel,
} from "@/components/reports/ReportShell";

const MONTH_LABEL = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
};

// ── Sales summary ────────────────────────────────────────────────────────────

function SalesSummaryTab() {
  const { data: invoices } = useInvoices();
  const { data: creditNotes } = useCreditNotes();
  const [period, setPeriod] = useState<Period>("year");

  const { months, totals } = aggregateSalesSummary(invoices ?? [], creditNotes ?? [], inPeriod(period));
  const periodLabel = PERIOD_LABELS[period];

  if ((invoices ?? []).length === 0) return <EmptyReport>No invoices yet.</EmptyReport>;

  return (
    <>
      <ReportIntro>What you invoiced against what actually came in, month by month.</ReportIntro>
      <PeriodPicker period={period} onChange={setPeriod} options={["month", "year", "all"]} />

      {months.length === 0 ? (
        <EmptyReport>No invoices in {periodLabel.toLowerCase()}.</EmptyReport>
      ) : (
        <>
          <StatTiles
            tiles={[
              { label: "Net sales", value: fmt(totals.net), tone: "sky" },
              { label: "Received", value: `${totals.collectedPct.toFixed(0)}%`, tone: totals.collectedPct >= 80 ? "good" : "plain" },
              { label: "Outstanding", value: fmt(totals.outstanding), tone: totals.outstanding > 0 ? "amber" : "plain" },
            ]}
          />

          <ReportGroupHeading label="By month" right={`${totals.invoices} invoice${totals.invoices === 1 ? "" : "s"}`} />
          {months.map((m) => (
            <ReportRow
              key={m.month}
              title={MONTH_LABEL(m.month)}
              sub={
                <>
                  {m.invoices} invoice{m.invoices === 1 ? "" : "s"} · VAT {fmt(m.vat)}
                  {m.credited > 0 && <span style={{ color: "#be123c" }}> · credited −{fmt(m.credited)}</span>}
                </>
              }
              value={fmt(m.net)}
              valueSub={m.outstanding > 0 ? `${fmt(m.outstanding)} still out` : "all collected"}
            />
          ))}

          <ReportActions
            filename="sales-summary"
            pdf={() => ({ kind: "salessummary", rows: months, totals, asAt: asAtLabel(), periodLabel })}
            fallbackHtml={(b, w) => buildSalesSummaryHTML(b, months, totals, asAtLabel(), w, periodLabel)}
            csv={() => ({
              filename: "sales-summary",
              headers: ["Month", "Invoices", "Net", "VAT", "Credited", "Outstanding"],
              rows: months.map((m) => [MONTH_LABEL(m.month), m.invoices, m.net, m.vat, m.credited, m.outstanding]),
            })}
            share={() => ({
              title: "Sales Summary",
              subtitle: `${periodLabel} · as at ${todayStr()}`,
              lines: [
                `Net sales: ${fmt(totals.net)} (${totals.invoices} invoices)`,
                `Received: ${fmt(totals.received)} · outstanding: ${fmt(totals.outstanding)}`,
                ``,
                ...months.map((m) => `${MONTH_LABEL(m.month)}: ${fmt(m.net)} · ${fmt(m.outstanding)} out`),
              ],
            })}
          />
        </>
      )}
    </>
  );
}

// ── Quote conversion ─────────────────────────────────────────────────────────

const OUTCOME_COLOR: Record<string, string> = {
  converted: "#0369A1",
  accepted: "#15803d",
  open: "#b45309",
  declined: "#be123c",
  expired: "#64748b",
};

function QuoteConversionTab() {
  const { data: quotes } = useQuotes();
  const [period, setPeriod] = useState<Period>("year");

  const { rows, totals } = aggregateQuoteConversion(quotes ?? [], inPeriod(period), todayStr());
  const periodLabel = PERIOD_LABELS[period];
  const pdfRows = rows.map((r) => ({ label: r.label, count: r.count, value: r.value }));

  if ((quotes ?? []).length === 0) return <EmptyReport>No quotes yet.</EmptyReport>;

  return (
    <>
      <ReportIntro>How many quotes turn into work, and what the rest were worth.</ReportIntro>
      <PeriodPicker period={period} onChange={setPeriod} options={["month", "year", "all"]} />

      {totals.quotes === 0 ? (
        <EmptyReport>No quotes issued in {periodLabel.toLowerCase()}.</EmptyReport>
      ) : (
        <>
          <StatTiles
            tiles={[
              { label: "Quotes", value: String(totals.quotes), tone: "plain" },
              { label: "Conversion", value: `${totals.conversionRate.toFixed(0)}%`, tone: totals.conversionRate >= 50 ? "good" : "amber" },
              { label: "Won", value: fmt(totals.wonValue), tone: "sky" },
            ]}
          />

          <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "#7DD3FC" }}>Value lost — declined &amp; expired</span>
              <span style={{ color: "#F59E0B", fontWeight: 700 }}>{fmt(totals.lostValue)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#7DD3FC" }}>Still open — {totals.open} quote{totals.open === 1 ? "" : "s"}</span>
              <span style={{ color: "#fff", fontWeight: 700 }}>{fmt(totals.openValue)}</span>
            </div>
          </div>

          <ReportGroupHeading label="Outcomes" right={fmt(totals.value)} />
          {rows.map((r) => (
            <ReportRow
              key={r.outcome}
              title={r.label}
              sub={`${r.count} quote${r.count === 1 ? "" : "s"} · ${totals.quotes ? ((r.count / totals.quotes) * 100).toFixed(0) : 0}% of all quotes`}
              value={fmt(r.value)}
              valueColor={OUTCOME_COLOR[r.outcome] ?? "#0C4A6E"}
            />
          ))}

          <ReportActions
            filename="quote-conversion"
            pdf={() => ({ kind: "quoteconversion", rows: pdfRows, totals, asAt: asAtLabel(), periodLabel })}
            fallbackHtml={(b, w) => buildQuoteConversionHTML(b, pdfRows, totals, asAtLabel(), w, periodLabel)}
            csv={() => ({
              filename: "quote-conversion",
              headers: ["Outcome", "Quotes", "Value"],
              rows: rows.map((r) => [r.label, r.count, r.value]),
            })}
            share={() => ({
              title: "Quote Conversion",
              subtitle: `${periodLabel} · as at ${todayStr()}`,
              lines: [
                `${totals.quotes} quotes worth ${fmt(totals.value)}`,
                `Conversion: ${totals.conversionRate.toFixed(0)}% — won ${fmt(totals.wonValue)}, lost ${fmt(totals.lostValue)}`,
                ``,
                ...rows.map((r) => `${r.label}: ${r.count} · ${fmt(r.value)}`),
              ],
            })}
          />
        </>
      )}
    </>
  );
}

// ── What sells ───────────────────────────────────────────────────────────────

function WhatSellsTab() {
  const { data: invoices } = useInvoices();
  const [period, setPeriod] = useState<Period>("year");

  const { rows, totals } = aggregateWhatSells(invoices ?? [], inPeriod(period));
  const periodLabel = PERIOD_LABELS[period];

  if ((invoices ?? []).length === 0) return <EmptyReport>No invoices yet.</EmptyReport>;

  return (
    <>
      <ReportIntro>Every invoice line added up by what it says, best seller first.</ReportIntro>
      <PeriodPicker period={period} onChange={setPeriod} options={["month", "year", "all"]} />

      {rows.length === 0 ? (
        <EmptyReport>No invoice lines in {periodLabel.toLowerCase()}.</EmptyReport>
      ) : (
        <>
          <StatTiles
            tiles={[
              { label: "Distinct lines", value: String(totals.lines), tone: "plain" },
              { label: "Invoiced on lines", value: fmt(totals.value), tone: "sky" },
              { label: "Top line", value: totals.value > 0 ? `${((rows[0].value / totals.value) * 100).toFixed(0)}%` : "—", tone: "amber" },
            ]}
          />

          <ReportGroupHeading label="What sells" right={`${rows.length}`} />
          {rows.slice(0, 25).map((r) => (
            <ReportRow
              key={r.description}
              title={r.description}
              sub={`${r.qty % 1 === 0 ? r.qty : r.qty.toFixed(2)} sold · on ${r.invoices} invoice${r.invoices === 1 ? "" : "s"}`}
              value={fmt(r.value)}
              valueSub={totals.value > 0 ? `${((r.value / totals.value) * 100).toFixed(0)}% of sales` : undefined}
            />
          ))}
          {rows.length > 25 && (
            <div style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 8px 2px" }}>+ {rows.length - 25} more — all of them are in the PDF</div>
          )}

          <ReportActions
            filename="what-sells"
            pdf={() => ({ kind: "whatsells", rows, totals, asAt: asAtLabel(), periodLabel })}
            fallbackHtml={(b, w) => buildWhatSellsHTML(b, rows, totals, asAtLabel(), w, periodLabel)}
            csv={() => ({
              filename: "what-sells",
              headers: ["Description", "Qty sold", "Invoices", "Value"],
              rows: rows.map((r) => [r.description, r.qty, r.invoices, r.value]),
            })}
            share={() => ({
              title: "What Sells",
              subtitle: `${periodLabel} · as at ${todayStr()}`,
              lines: rows.slice(0, 20).map((r) => `${r.description}: ${r.qty} · ${fmt(r.value)}`),
            })}
          />
        </>
      )}
    </>
  );
}

// ── Recurring revenue ────────────────────────────────────────────────────────

function RecurringTab() {
  const { data: invoices } = useInvoices();
  const { rows, totals } = aggregateRecurring(invoices ?? [], todayStr());

  if (rows.length === 0) {
    return (
      <EmptyReport>
        No recurring invoices set up. Set an invoice to repeat weekly, monthly, quarterly or annually and it shows here.
      </EmptyReport>
    );
  }

  return (
    <>
      <ReportIntro>The invoices that bill themselves, and what they commit to each month.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "Recurring", value: String(totals.count), tone: "plain" },
          { label: "Per month", value: fmt(totals.perMonth), tone: "sky" },
          { label: "Next 30 days", value: fmt(totals.dueSoon), tone: "amber" },
        ]}
      />

      <ReportGroupHeading label="Next to run" />
      {rows.map((r) => (
        <ReportRow
          key={r.id}
          title={r.client}
          sub={`${r.docNumber ? `${r.docNumber} · ` : ""}${r.recurrenceLabel}${r.nextRun ? ` · next ${r.nextRun}` : ""}`}
          value={fmt(r.amount)}
          valueSub={`${fmt(r.perMonth)}/mo`}
        />
      ))}

      <ReportActions
        filename="recurring-revenue"
        pdf={() => ({ kind: "recurringrevenue", rows, totals, asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildRecurringRevenueHTML(b, rows, totals, asAtLabel(), w)}
        csv={() => ({
          filename: "recurring-revenue",
          headers: ["Client", "Document", "Recurrence", "Next run", "Amount", "Per month"],
          rows: rows.map((r) => [r.client, r.docNumber ?? "", r.recurrenceLabel, r.nextRun ?? "", r.amount, r.perMonth]),
        })}
        share={() => ({
          title: "Recurring Revenue",
          subtitle: `As at ${todayStr()}`,
          lines: [
            `${totals.count} recurring invoices · ${fmt(totals.perMonth)}/month committed`,
            `Billing in the next 30 days: ${fmt(totals.dueSoon)}`,
            ``,
            ...rows.map((r) => `${r.client} — ${r.recurrenceLabel}, next ${r.nextRun || "—"} · ${fmt(r.amount)}`),
          ],
        })}
      />
    </>
  );
}

// Sales Reports — one tool over the Sales dashboards: how sales are tracking,
// whether quoting is working, what actually sells, and what bills itself.
export function SalesReportsView() {
  const invoice = useToolAccess("invoice");
  const quote = useToolAccess("quote");

  return (
    <ReportsTool
      title="Sales Reports"
      loading={invoice.loading || quote.loading}
      tabs={[
        { id: "summary", label: "📈 Sales summary", show: invoice.canView, render: () => <SalesSummaryTab /> },
        { id: "quotes", label: "📋 Quote conversion", show: quote.canView, render: () => <QuoteConversionTab /> },
        { id: "items", label: "🏷️ What sells", show: invoice.canView, render: () => <WhatSellsTab /> },
        { id: "recurring", label: "🔁 Recurring", show: invoice.canView, render: () => <RecurringTab /> },
      ]}
    />
  );
}
