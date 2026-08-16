"use client";

import { useStockItems } from "@/lib/supabase/hooks/useStock";
import { useCostings } from "@/lib/supabase/hooks/useCostings";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { aggregateCostingDrift, aggregateMargins, aggregateReorder, aggregateStockOnHand } from "@/lib/priceListReports";
import { buildCostingDriftHTML, buildMarginsHTML, buildReorderHTML, buildStockOnHandHTML } from "@/lib/docgen/buildLedgerHTML";
import { fmt, todayStr } from "@/lib/format";
import {
  ReportsTool,
  ReportIntro,
  StatTiles,
  ReportGroupHeading,
  ReportRow,
  ReportActions,
  EmptyReport,
  asAtLabel,
} from "@/components/reports/ReportShell";

const qtyText = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2));

// ── Stock on hand ────────────────────────────────────────────────────────────

function StockOnHandTab() {
  const { data: items } = useStockItems();
  const { rows, totals } = aggregateStockOnHand(items ?? []);

  if (rows.length === 0) {
    return <EmptyReport>Nothing on your price list carries stock. Products and materials do; services, labour and packages don&apos;t.</EmptyReport>;
  }

  return (
    <>
      <ReportIntro>What you hold and what it&apos;s worth — the closing-stock figure an accountant asks for.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "At cost", value: fmt(totals.atCost), tone: "sky" },
          { label: "At sell price", value: fmt(totals.atSell), tone: "plain" },
          { label: "Profit in stock", value: fmt(totals.potential), tone: "amber" },
        ]}
      />

      <ReportGroupHeading label="Held" right={`${totals.items} item${totals.items === 1 ? "" : "s"} · ${qtyText(totals.units)} units`} />
      {rows.map((r) => (
        <ReportRow
          key={r.id}
          title={r.name}
          sub={`${r.typeLabel} · ${qtyText(r.qty)} × ${fmt(r.costPrice)}`}
          value={fmt(r.atCost)}
          valueSub={`${fmt(r.atSell)} at sell`}
        />
      ))}

      <ReportActions
        filename="stock-on-hand"
        pdf={() => ({ kind: "stockonhand", rows, totals, asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildStockOnHandHTML(b, rows, totals, asAtLabel(), w)}
        share={() => ({
          title: "Stock on Hand",
          subtitle: `As at ${todayStr()}`,
          lines: [
            `Closing stock at cost: ${fmt(totals.atCost)}`,
            `At sell price: ${fmt(totals.atSell)} · profit if it all sells ${fmt(totals.potential)}`,
            ``,
            ...rows.map((r) => `${r.name}: ${qtyText(r.qty)} × ${fmt(r.costPrice)} = ${fmt(r.atCost)}`),
          ],
        })}
      />
    </>
  );
}

// ── Margins ──────────────────────────────────────────────────────────────────

function MarginsTab() {
  const { data: items } = useStockItems();
  const { rows, totals } = aggregateMargins(items ?? []);

  if (rows.length === 0) return <EmptyReport>Nothing on your price list yet.</EmptyReport>;

  return (
    <>
      <ReportIntro>What you make on every item, worst first.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "Average margin", value: `${totals.averageMargin.toFixed(0)}%`, tone: totals.averageMargin >= 30 ? "good" : "plain" },
          { label: "At or below cost", value: String(totals.atRisk), tone: totals.atRisk > 0 ? "bad" : "good" },
          { label: "No price set", value: String(totals.unpriced), tone: totals.unpriced > 0 ? "amber" : "plain" },
        ]}
      />

      <ReportGroupHeading label="Every item" right={`${totals.priced} of ${totals.items} priced`} />
      {rows.map((r) => (
        <ReportRow
          key={r.id}
          title={
            <>
              {r.name}
              {r.atRisk && <span style={{ color: "#be123c", fontWeight: 700 }}> ⚠</span>}
            </>
          }
          sub={
            r.unpriced
              ? `${r.typeLabel} · costs ${fmt(r.costPrice)} · no sell price set`
              : `${r.typeLabel} · ${fmt(r.costPrice)} → ${fmt(r.sellPrice)} · markup ${r.markupPct.toFixed(0)}%`
          }
          value={r.unpriced ? "—" : `${r.marginPct.toFixed(0)}%`}
          valueSub={r.unpriced ? "unpriced" : `${fmt(r.profit)} each`}
          valueColor={r.unpriced ? "#94a3b8" : r.atRisk ? "#be123c" : "#0C4A6E"}
          dim={r.unpriced}
        />
      ))}

      <ReportActions
        filename="margins"
        pdf={() => ({ kind: "margins", rows, totals, asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildMarginsHTML(b, rows, totals, asAtLabel(), w)}
        share={() => ({
          title: "Margins",
          subtitle: `As at ${todayStr()}`,
          lines: [
            `Average margin: ${totals.averageMargin.toFixed(0)}% across ${totals.priced} priced items`,
            totals.atRisk > 0 ? `${totals.atRisk} selling at or below cost` : "Nothing selling at a loss",
            ``,
            ...rows.filter((r) => !r.unpriced).map((r) => `${r.name}: ${fmt(r.costPrice)} → ${fmt(r.sellPrice)} · ${r.marginPct.toFixed(0)}%`),
          ],
        })}
      />
    </>
  );
}

// ── Reorder ──────────────────────────────────────────────────────────────────

function ReorderTab() {
  const { data: items } = useStockItems();
  const { rows, totals } = aggregateReorder(items ?? []);

  if (rows.length === 0) {
    return <EmptyReport>Nothing needs reordering. Only items with a reorder level set can appear here.</EmptyReport>;
  }

  return (
    <>
      <ReportIntro>Everything at or under its reorder level — the shopping list.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "To reorder", value: String(totals.items), tone: "amber" },
          { label: "Out of stock", value: String(totals.outOfStock), tone: totals.outOfStock > 0 ? "bad" : "good" },
          { label: "Cost to restock", value: fmt(totals.costToRestock), tone: "sky" },
        ]}
      />

      <ReportGroupHeading label="Buy" />
      {rows.map((r) => (
        <ReportRow
          key={r.id}
          title={
            <>
              {r.name}
              {r.outOfStock && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", marginLeft: 6 }}>
                  Out
                </span>
              )}
            </>
          }
          sub={`${r.typeLabel} · ${qtyText(r.qty)} on hand, reorder at ${qtyText(r.reorderLevel)}`}
          value={`${qtyText(r.shortBy)} short`}
          valueSub={r.costToRestock > 0 ? fmt(r.costToRestock) : undefined}
          valueColor={r.outOfStock ? "#be123c" : "#b45309"}
        />
      ))}

      <ReportActions
        filename="reorder-list"
        pdf={() => ({ kind: "reorderlist", rows, totals, asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildReorderHTML(b, rows, totals, asAtLabel(), w)}
        share={() => ({
          title: "Reorder List",
          subtitle: `As at ${todayStr()}`,
          lines: [
            `${totals.items} to reorder · ${fmt(totals.costToRestock)} to restock`,
            ``,
            ...rows.map((r) => `${r.name}: ${qtyText(r.qty)} on hand, buy ${qtyText(r.shortBy)}${r.outOfStock ? " (OUT)" : ""}`),
          ],
        })}
      />
    </>
  );
}

// ── Costings vs price list ───────────────────────────────────────────────────

function CostingDriftTab() {
  const { data: items } = useStockItems();
  const { data: costings } = useCostings();
  const { rows, totals } = aggregateCostingDrift(costings ?? [], items ?? []);

  if (rows.length === 0) {
    return <EmptyReport>No costings saved yet. Work one out in the Cost Calculator and it appears here.</EmptyReport>;
  }

  return (
    <>
      <ReportIntro>What each costing says you should charge, against what you actually charge.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "Costings", value: `${totals.linked}/${totals.costings}`, tone: "plain" },
          { label: "Priced under", value: String(totals.under), tone: totals.under > 0 ? "bad" : "good" },
          { label: "Given away", value: fmt(totals.shortfall), tone: totals.shortfall > 0 ? "amber" : "plain" },
        ]}
      />

      <ReportGroupHeading label="Costings" right={`${totals.linked} on the price list`} />
      {rows.map((r) => (
        <ReportRow
          key={r.id}
          title={r.name}
          sub={
            r.linked ? (
              <>
                Costs {fmt(r.totalCost)} · should charge {fmt(r.suggestedPrice)} · charging {fmt(r.listedPrice ?? 0)}
              </>
            ) : (
              <>
                Costs {fmt(r.totalCost)} · should charge {fmt(r.suggestedPrice)} · not on the price list
              </>
            )
          }
          value={r.linked ? `${r.difference >= 0 ? "+" : "−"}${fmt(Math.abs(r.difference))}` : "—"}
          valueSub={r.linked && r.suggestedPrice > 0 ? `${r.differencePct >= 0 ? "+" : ""}${r.differencePct.toFixed(0)}%` : undefined}
          valueColor={r.under ? "#be123c" : r.linked ? "#0C4A6E" : "#94a3b8"}
          dim={!r.linked}
        />
      ))}

      <ReportActions
        filename="costings-vs-price-list"
        pdf={() => ({ kind: "costingdrift", rows, totals, asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildCostingDriftHTML(b, rows, totals, asAtLabel(), w)}
        share={() => ({
          title: "Costings vs Price List",
          subtitle: `As at ${todayStr()}`,
          lines: [
            `${totals.under} of ${totals.linked} priced under their costing · ${fmt(totals.shortfall)} given away per sale`,
            ``,
            ...rows
              .filter((r) => r.linked)
              .map((r) => `${r.name}: should charge ${fmt(r.suggestedPrice)}, charging ${fmt(r.listedPrice ?? 0)}`),
          ],
        })}
      />
    </>
  );
}

// Price List Reports — one tool over Items and the Cost Calculator: what you
// hold, what you make on it, what to buy, and whether your prices still match
// the costings behind them.
export function PriceListReportsView() {
  const stock = useToolAccess("stock");
  const recipe = useToolAccess("recipe");

  return (
    <ReportsTool
      title="Price List Reports"
      loading={stock.loading || recipe.loading}
      tabs={[
        { id: "stock", label: "📦 Stock on hand", show: stock.canView, render: () => <StockOnHandTab /> },
        { id: "margins", label: "📈 Margins", show: stock.canView, render: () => <MarginsTab /> },
        { id: "reorder", label: "🛒 Reorder", show: stock.canView, render: () => <ReorderTab /> },
        { id: "costings", label: "🍳 Costings", show: recipe.canView, render: () => <CostingDriftTab /> },
      ]}
    />
  );
}
