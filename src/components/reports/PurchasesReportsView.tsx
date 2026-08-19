"use client";

import { useState } from "react";
import { useSupplierInvoices } from "@/lib/supabase/hooks/useSupplierInvoices";
import { usePurchaseOrders } from "@/lib/supabase/hooks/usePurchaseOrders";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import {
  aggregateBillsDue,
  aggregateCategorySpend,
  aggregateCommitted,
  aggregateSupplierSpend,
  BILL_BUCKET_LABEL,
  type BillDueBucket,
} from "@/lib/purchasesReports";
import { buildBillsDueHTML, buildCategorySpendHTML, buildCommittedHTML, buildSupplierSpendHTML } from "@/lib/docgen/buildLedgerHTML";
import { fmt, todayStr } from "@/lib/format";
import { inPeriod, PERIOD_LABELS, type Period } from "@/lib/period";
import { useMoneySummary } from "@/lib/useMoneySummary";
import { ALL_ACCOUNTS } from "@/components/ui/BankAccountSelector";
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

// ── Spend by supplier ────────────────────────────────────────────────────────

function SupplierSpendTab() {
  const { data: supplierInvoices } = useSupplierInvoices();
  const { data: expenses } = useExpenses();
  const { data: contacts } = useContacts();
  const [period, setPeriod] = useState<Period>("year");

  const { rows, totals } = aggregateSupplierSpend(supplierInvoices ?? [], expenses ?? [], contacts ?? [], inPeriod(period));
  const periodLabel = PERIOD_LABELS[period];

  return (
    <>
      <ReportIntro>What each supplier cost you, and what&apos;s still owed to them.</ReportIntro>
      <PeriodPicker period={period} onChange={setPeriod} options={["month", "year", "all"]} />

      {rows.length === 0 ? (
        <EmptyReport>No supplier spend in {periodLabel.toLowerCase()}.</EmptyReport>
      ) : (
        <>
          <StatTiles
            tiles={[
              { label: "Billed", value: fmt(totals.billed), tone: "plain" },
              { label: "Paid out", value: fmt(totals.paid), tone: "sky" },
              { label: "Still owed", value: fmt(totals.outstanding), tone: totals.outstanding > 0 ? "amber" : "good" },
            ]}
          />

          <ReportGroupHeading label="Suppliers" right={`${totals.suppliers}`} />
          {rows.map((r) => (
            <ReportRow
              key={r.name}
              title={r.name}
              sub={
                <>
                  {r.invoices > 0 ? `${r.invoices} bill${r.invoices === 1 ? "" : "s"} · billed ${fmt(r.billed)}` : "No bills captured"} · paid {fmt(r.paid)}
                  {r.terms ? ` · ${r.terms}` : ""}
                </>
              }
              value={fmt(Math.max(r.billed, r.paid))}
              valueSub={r.outstanding > 0 ? `${fmt(r.outstanding)} owing` : undefined}
              valueColor={r.outstanding > 0 ? "#b45309" : "#0C4A6E"}
            />
          ))}

          <ReportActions
            filename="spend-by-supplier"
            pdf={() => ({ kind: "supplierspend", rows, totals, asAt: asAtLabel(), periodLabel })}
            fallbackHtml={(b, w) => buildSupplierSpendHTML(b, rows, totals, asAtLabel(), w, periodLabel)}
            csv={() => ({
              filename: "spend-by-supplier",
              headers: ["Supplier", "Bills", "Billed", "Paid", "Outstanding", "Terms"],
              rows: rows.map((r) => [r.name, r.invoices, r.billed, r.paid, r.outstanding, r.terms ?? ""]),
            })}
            share={() => ({
              title: "Spend by Supplier",
              subtitle: `${periodLabel} · as at ${todayStr()}`,
              lines: [
                `Billed ${fmt(totals.billed)} · paid ${fmt(totals.paid)} · still owed ${fmt(totals.outstanding)}`,
                ``,
                ...rows.map((r) => `${r.name}: billed ${fmt(r.billed)}, paid ${fmt(r.paid)}${r.outstanding > 0 ? `, owing ${fmt(r.outstanding)}` : ""}`),
              ],
            })}
          />
        </>
      )}
    </>
  );
}

// ── Spend by category ────────────────────────────────────────────────────────

function CategorySpendTab() {
  const [period, setPeriod] = useState<Period>("year");

  // The same assembled inputs the Profit & Loss reads, so this schedule and the
  // top-eight list on that report cannot disagree about a category.
  const { pnlInputs, within } = useMoneySummary(period, ALL_ACCOUNTS);
  const { rows, totals } = aggregateCategorySpend(pnlInputs, within);
  const periodLabel = PERIOD_LABELS[period];

  return (
    <>
      <ReportIntro>Every SARS category with its total — the schedule your accountant works from.</ReportIntro>
      <PeriodPicker period={period} onChange={setPeriod} options={["month", "year", "all"]} />

      {rows.length === 0 ? (
        <EmptyReport>No expenses in {periodLabel.toLowerCase()}.</EmptyReport>
      ) : (
        <>
          <StatTiles
            tiles={[
              { label: "Total spend", value: fmt(totals.total), tone: "sky" },
              { label: "Categories", value: String(totals.categories), tone: "plain" },
              { label: "Uncategorised", value: fmt(totals.uncategorised), tone: totals.uncategorised > 0 ? "amber" : "good" },
            ]}
          />

          <ReportGroupHeading label="By category" right={`${totals.count} entr${totals.count === 1 ? "y" : "ies"}`} />
          {rows.map((r) => (
            <ReportRow
              key={r.category}
              title={r.category}
              sub={`${r.count} entr${r.count === 1 ? "y" : "ies"} · ${r.sharePct.toFixed(1)}% of spend`}
              value={fmt(r.amount)}
              valueColor={r.category === "Uncategorised" ? "#b45309" : "#0C4A6E"}
            />
          ))}

          <ReportActions
            filename="spend-by-category"
            pdf={() => ({ kind: "categoryspend", rows, totals, asAt: asAtLabel(), periodLabel })}
            fallbackHtml={(b, w) => buildCategorySpendHTML(b, rows, totals, asAtLabel(), w, periodLabel)}
            csv={() => ({
              filename: "spend-by-category",
              headers: ["Category", "Entries", "Amount", "Share %"],
              rows: rows.map((r) => [r.category, r.count, r.amount, r.sharePct.toFixed(1)]),
            })}
            share={() => ({
              title: "Spend by Category",
              subtitle: `${periodLabel} · as at ${todayStr()}`,
              lines: [`Total spend: ${fmt(totals.total)}`, ``, ...rows.map((r) => `${r.category}: ${fmt(r.amount)} (${r.sharePct.toFixed(0)}%)`)],
            })}
          />
        </>
      )}
    </>
  );
}

// ── Committed on order ───────────────────────────────────────────────────────

function CommittedTab() {
  const { data: purchaseOrders } = usePurchaseOrders();
  const { data: supplierInvoices } = useSupplierInvoices();

  const { rows, totals } = aggregateCommitted(purchaseOrders ?? [], supplierInvoices ?? [], todayStr());

  if (rows.length === 0) {
    return <EmptyReport>Nothing on order. Purchase orders appear here until a supplier invoice is captured against them.</EmptyReport>;
  }

  return (
    <>
      <ReportIntro>Orders you&apos;ve placed that haven&apos;t been billed yet — money promised, not yet on the books.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "On order", value: fmt(totals.amount), tone: "amber" },
          { label: "Open orders", value: String(totals.orders), tone: "plain" },
          { label: "Past delivery", value: String(totals.overdue), tone: totals.overdue > 0 ? "bad" : "good" },
        ]}
      />

      <ReportGroupHeading label="Open orders" right={totals.overdueAmount > 0 ? `${fmt(totals.overdueAmount)} overdue` : undefined} />
      {rows.map((r) => {
        const late = !!r.requestedDelivery && r.requestedDelivery < todayStr();
        return (
          <ReportRow
            key={r.id}
            title={
              <>
                {r.supplier}
                {late && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", marginLeft: 6 }}>
                    Past delivery
                  </span>
                )}
              </>
            }
            sub={`${r.docNumber ? `${r.docNumber} · ` : ""}ordered ${r.issueDate || "—"} · ${r.ageDays}d ago${r.requestedDelivery ? ` · wanted by ${r.requestedDelivery}` : ""}`}
            value={fmt(r.amount)}
            valueSub={r.status}
            valueColor={late ? "#be123c" : "#0C4A6E"}
          />
        );
      })}

      <ReportActions
        filename="committed-on-order"
        pdf={() => ({ kind: "committedonorder", rows, totals, asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildCommittedHTML(b, rows, totals, asAtLabel(), w)}
        csv={() => ({
          filename: "committed-on-order",
          headers: ["Supplier", "Document", "Ordered", "Wanted by", "Age (days)", "Status", "Amount"],
          rows: rows.map((r) => [r.supplier, r.docNumber ?? "", r.issueDate ?? "", r.requestedDelivery ?? "", r.ageDays, r.status, r.amount]),
        })}
        share={() => ({
          title: "Committed on Order",
          subtitle: `As at ${todayStr()}`,
          lines: [
            `${totals.orders} open orders worth ${fmt(totals.amount)}`,
            totals.overdue > 0 ? `${totals.overdue} past their delivery date (${fmt(totals.overdueAmount)})` : "None past their delivery date",
            ``,
            ...rows.map((r) => `${r.supplier} ${r.docNumber}: ${fmt(r.amount)} · ordered ${r.issueDate}`),
          ],
        })}
      />
    </>
  );
}

// ── Bills due ────────────────────────────────────────────────────────────────

const BUCKET_COLOR: Record<BillDueBucket, string> = {
  overdue: "#be123c",
  week: "#b45309",
  month: "#0369A1",
  later: "#64748b",
  undated: "#94a3b8",
};

function BillsDueTab() {
  const { data: supplierInvoices } = useSupplierInvoices();
  const { rows, totals } = aggregateBillsDue(supplierInvoices ?? [], todayStr());

  if (rows.length === 0) return <EmptyReport>Nothing outstanding — every supplier bill is settled.</EmptyReport>;

  const buckets: BillDueBucket[] = ["overdue", "week", "month", "later", "undated"];

  return (
    <>
      <ReportIntro>What has to be paid and when — the forward view ageing doesn&apos;t give you.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "Overdue", value: fmt(totals.overdue), tone: totals.overdue > 0 ? "bad" : "good" },
          { label: "Next 7 days", value: fmt(totals.week), tone: "amber" },
          { label: "Next 30 days", value: fmt(totals.month), tone: "sky" },
        ]}
      />

      <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Owed in total</div>
          <div style={{ fontSize: 10, color: "#7DD3FC", marginTop: 2 }}>{totals.count} bill{totals.count === 1 ? "" : "s"} still to pay</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", whiteSpace: "nowrap", marginLeft: 10 }}>{fmt(totals.total)}</div>
      </div>

      {buckets.map((bucket) => {
        const mine = rows.filter((r) => r.bucket === bucket);
        if (mine.length === 0) return null;
        return (
          <div key={bucket}>
            <ReportGroupHeading label={BILL_BUCKET_LABEL[bucket]} right={fmt(totals[bucket])} />
            {mine.map((r) => (
              <ReportRow
                key={r.id}
                title={r.supplier}
                sub={`${r.docNumber ? `${r.docNumber} · ` : ""}${r.dueDate ? `due ${r.dueDate}` : "no due date"}`}
                value={fmt(r.amount)}
                valueColor={BUCKET_COLOR[bucket]}
              />
            ))}
          </div>
        );
      })}

      <ReportActions
        filename="bills-due"
        pdf={() => ({
          kind: "billsdue",
          rows: rows.map((r) => ({ supplier: r.supplier, docNumber: r.docNumber, dueDate: r.dueDate, amount: r.amount, bucketLabel: BILL_BUCKET_LABEL[r.bucket] })),
          totals,
          asAt: asAtLabel(),
        })}
        fallbackHtml={(b, w) =>
          buildBillsDueHTML(
            b,
            rows.map((r) => ({ supplier: r.supplier, docNumber: r.docNumber, dueDate: r.dueDate, amount: r.amount, bucketLabel: BILL_BUCKET_LABEL[r.bucket] })),
            totals,
            asAtLabel(),
            w
          )
        }
        csv={() => ({
          filename: "bills-due",
          headers: ["Supplier", "Document", "Due date", "When", "Amount"],
          rows: rows.map((r) => [r.supplier, r.docNumber ?? "", r.dueDate ?? "", BILL_BUCKET_LABEL[r.bucket], r.amount]),
        })}
        share={() => ({
          title: "Bills Due",
          subtitle: `As at ${todayStr()}`,
          lines: [
            `Owed in total: ${fmt(totals.total)} across ${totals.count} bills`,
            `Overdue ${fmt(totals.overdue)} · 7 days ${fmt(totals.week)} · 30 days ${fmt(totals.month)}`,
            ``,
            ...rows.map((r) => `${r.supplier} ${r.docNumber}: ${fmt(r.amount)} ${r.dueDate ? `due ${r.dueDate}` : "(no due date)"}`),
          ],
        })}
      />
    </>
  );
}

// Purchases Reports — one tool over the Purchases dashboards: who you buy from,
// what it goes on, what you've committed to, and what falls due next.
export function PurchasesReportsView() {
  const supplierInvoice = useToolAccess("supplierinvoice");
  const purchaseOrder = useToolAccess("purchaseorder");
  const expense = useToolAccess("expense");

  return (
    <ReportsTool
      title="Purchases Reports"
      loading={supplierInvoice.loading || purchaseOrder.loading || expense.loading}
      tabs={[
        { id: "suppliers", label: "🏬 By supplier", show: supplierInvoice.canView || expense.canView, render: () => <SupplierSpendTab /> },
        { id: "categories", label: "🧾 By category", show: expense.canView, render: () => <CategorySpendTab /> },
        { id: "committed", label: "🛒 On order", show: purchaseOrder.canView, render: () => <CommittedTab /> },
        { id: "due", label: "⏳ Bills due", show: supplierInvoice.canView, render: () => <BillsDueTab /> },
      ]}
    />
  );
}
