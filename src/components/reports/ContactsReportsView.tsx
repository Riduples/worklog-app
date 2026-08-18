"use client";

import { useState } from "react";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { useBookings } from "@/lib/supabase/hooks/useBookings";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { aggregateDirectory, aggregateDormant, aggregateMissingDetails, aggregatePayers } from "@/lib/contactsReports";
import { buildDirectoryHTML, buildDormantHTML, buildMissingDetailsHTML, buildPayersHTML } from "@/lib/docgen/buildLedgerHTML";
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

// ── Directory ────────────────────────────────────────────────────────────────

function DirectoryTab() {
  const { data: contacts } = useContacts();
  const { rows, totals } = aggregateDirectory(contacts ?? []);

  if (rows.length === 0) return <EmptyReport>No contacts yet.</EmptyReport>;

  const groups = (["client", "supplier"] as const).map((type) => ({
    type,
    label: type === "client" ? "Customers" : "Suppliers",
    people: rows.filter((r) => r.type === type),
  }));

  return (
    <>
      <ReportIntro>Everyone you deal with, on one printable page.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "Customers", value: String(totals.customers), tone: "sky" },
          { label: "Suppliers", value: String(totals.suppliers), tone: "amber" },
          { label: "Contacts", value: String(totals.customers + totals.suppliers), tone: "plain" },
        ]}
      />

      {groups.map(
        (g) =>
          g.people.length > 0 && (
            <div key={g.type}>
              <ReportGroupHeading label={g.label} right={`${g.people.length}`} />
              {g.people.map((r) => (
                <ReportRow
                  key={r.id}
                  title={r.name}
                  sub={
                    <>
                      {[r.phone, r.email].filter(Boolean).join(" · ") || "No phone or email"}
                      {r.address ? ` · ${r.address}` : ""}
                      {r.bank ? ` · 🏦 ${r.bank}` : ""}
                    </>
                  }
                  value={r.paymentNote || undefined}
                  valueColor="#64748b"
                />
              ))}
            </div>
          )
      )}

      <ReportActions
        filename="contact-directory"
        pdf={() => ({ kind: "contactdirectory", rows, totals, asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildDirectoryHTML(b, rows, totals, asAtLabel(), w)}
        csv={() => ({
          filename: "contact-directory",
          headers: ["Name", "Type", "Phone", "Email", "Address", "Bank", "Payment note"],
          rows: rows.map((r) => [r.name, r.typeLabel, r.phone ?? "", r.email ?? "", r.address ?? "", r.bank ?? "", r.paymentNote ?? ""]),
        })}
        share={() => ({
          title: "Contact Directory",
          subtitle: `As at ${todayStr()}`,
          lines: rows.map((r) => `${r.name} (${r.typeLabel}) — ${[r.phone, r.email].filter(Boolean).join(" · ") || "no contact details"}`),
        })}
      />
    </>
  );
}

// ── Who pays late ────────────────────────────────────────────────────────────

const MEASURED_COLOR: Record<string, string> = {
  "Good payer": "#15803d",
  "Slow payer": "#b45309",
  "Problem payer": "#be123c",
  "Not enough history": "#94a3b8",
};

function PayersTab() {
  const { data: contacts } = useContacts();
  const { data: invoices } = useInvoices();
  const { rows, totals } = aggregatePayers(contacts ?? [], invoices ?? [], todayStr());

  if (rows.length === 0) return <EmptyReport>No customers yet.</EmptyReport>;

  return (
    <>
      <ReportIntro>How quickly each customer actually pays, against how they&apos;re marked.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "Measured", value: `${totals.measured}/${totals.customers}`, tone: "plain" },
          { label: "Record is wrong", value: String(totals.disagree), tone: totals.disagree > 0 ? "amber" : "good" },
          { label: "Overdue now", value: fmt(totals.overdueAmount), tone: totals.overdueAmount > 0 ? "bad" : "good" },
        ]}
      />

      <ReportGroupHeading label="Slowest first" />
      {rows.map((r) => (
        <ReportRow
          key={r.id}
          title={
            <>
              {r.name}
              {r.disagrees && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "#fff7ed", color: "#b45309", border: "1px solid #fed7aa", marginLeft: 6 }}>
                  Marked {r.behaviour.toLowerCase()}
                </span>
              )}
            </>
          }
          sub={
            r.averageDays == null ? (
              "No settled invoices yet — nothing to measure"
            ) : (
              <>
                Pays in {r.averageDays.toFixed(0)} days on average · {r.paidInvoices} settled
                {r.overdueCount > 0 && <span style={{ color: "#be123c" }}> · {r.overdueCount} overdue now</span>}
              </>
            )
          }
          value={r.measured}
          valueSub={r.overdueAmount > 0 ? fmt(r.overdueAmount) : undefined}
          valueColor={MEASURED_COLOR[r.measured] ?? "#0C4A6E"}
          dim={r.averageDays == null}
        />
      ))}

      <ReportActions
        filename="who-pays-late"
        pdf={() => ({ kind: "payers", rows, totals, asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildPayersHTML(b, rows, totals, asAtLabel(), w)}
        csv={() => ({
          filename: "who-pays-late",
          headers: ["Name", "Marked as", "Measured", "Avg days to pay", "Settled invoices", "Overdue now", "Overdue amount"],
          rows: rows.map((r) => [r.name, r.behaviour, r.measured, r.averageDays == null ? "" : r.averageDays.toFixed(0), r.paidInvoices, r.overdueCount, r.overdueAmount]),
        })}
        share={() => ({
          title: "Who Pays Late",
          subtitle: `As at ${todayStr()}`,
          lines: [
            `${totals.measured} of ${totals.customers} customers have enough history to measure`,
            totals.disagree > 0 ? `${totals.disagree} marked differently to how they actually pay` : "Every record matches the measurement",
            ``,
            ...rows.filter((r) => r.averageDays != null).map((r) => `${r.name}: ${r.averageDays!.toFixed(0)} days — ${r.measured}`),
          ],
        })}
      />
    </>
  );
}

// ── Dormant ──────────────────────────────────────────────────────────────────

const MONTH_OPTIONS = [3, 6, 12];

function DormantTab() {
  const { data: contacts } = useContacts();
  const { data: invoices } = useInvoices();
  const { data: quotes } = useQuotes();
  const { data: bookings } = useBookings();
  const [months, setMonths] = useState(6);

  const { rows, totals } = aggregateDormant(contacts ?? [], invoices ?? [], quotes ?? [], bookings ?? [], todayStr(), months);
  const monthsLabel = `${months} months`;

  return (
    <>
      <ReportIntro>Customers nobody has invoiced, quoted or booked in a while.</ReportIntro>

      <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3, marginBottom: 14 }}>
        {MONTH_OPTIONS.map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            style={{ flex: 1, padding: "7px 6px", borderRadius: 8, border: "none", background: months === m ? "#fff" : "transparent", color: months === m ? "#0C4A6E" : "#64748b", fontSize: 11.5, fontWeight: 700, cursor: "pointer", boxShadow: months === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
          >
            Quiet {m} months
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyReport>Nobody has been quiet for {monthsLabel}.</EmptyReport>
      ) : (
        <>
          <StatTiles
            tiles={[
              { label: "Gone quiet", value: String(totals.dormant), tone: "amber" },
              { label: "Never used", value: String(totals.never), tone: "plain" },
              { label: "Customers", value: String(totals.customers), tone: "sky" },
            ]}
          />

          <ReportGroupHeading label="Who to call" right={`${rows.length}`} />
          {rows.map((r) => (
            <ReportRow
              key={r.id}
              title={r.name}
              sub={
                r.never
                  ? `${r.phone || "No phone"} · never invoiced, quoted or booked`
                  : `${r.phone || "No phone"} · last ${r.lastSeenWhat} ${r.lastSeen}`
              }
              value={r.daysQuiet == null ? "—" : `${r.daysQuiet}d`}
              valueSub={r.never ? "never used" : "quiet"}
              valueColor={r.never ? "#94a3b8" : "#b45309"}
              dim={r.never}
            />
          ))}

          <ReportActions
            filename="dormant-customers"
            pdf={() => ({ kind: "dormantcustomers", rows, totals, asAt: asAtLabel(), monthsLabel })}
            fallbackHtml={(b, w) => buildDormantHTML(b, rows, totals, asAtLabel(), w, monthsLabel)}
            csv={() => ({
              filename: "dormant-customers",
              headers: ["Name", "Phone", "Last activity", "Last seen", "Days quiet"],
              rows: rows.map((r) => [r.name, r.phone ?? "", r.never ? "Never used" : r.lastSeenWhat, r.never ? "" : r.lastSeen, r.daysQuiet ?? ""]),
            })}
            share={() => ({
              title: "Dormant Customers",
              subtitle: `Quiet ${monthsLabel}+ · as at ${todayStr()}`,
              lines: rows.map((r) => `${r.name} — ${r.phone || "no phone"} · ${r.never ? "never used" : `last ${r.lastSeenWhat} ${r.lastSeen}`}`),
            })}
          />
        </>
      )}
    </>
  );
}

// ── Missing details ──────────────────────────────────────────────────────────

function MissingTab() {
  const { data: contacts } = useContacts();
  const { rows, totals } = aggregateMissingDetails(contacts ?? []);

  if (totals.contacts === 0) return <EmptyReport>No contacts yet.</EmptyReport>;
  if (rows.length === 0) return <EmptyReport>Every contact is complete — nothing missing.</EmptyReport>;

  return (
    <>
      <ReportIntro>Records too thin to send a statement, a remittance or a reminder to.</ReportIntro>

      <StatTiles
        tiles={[
          { label: "Incomplete", value: `${totals.incomplete}/${totals.contacts}`, tone: "amber" },
          { label: "Blocking", value: String(totals.blocking), tone: totals.blocking > 0 ? "bad" : "good" },
          { label: "Complete", value: String(totals.contacts - totals.incomplete), tone: "good" },
        ]}
      />

      <ReportGroupHeading label="Fill these in" />
      {rows.map((r) => (
        <ReportRow
          key={r.id}
          title={
            <>
              {r.name}
              {r.blocking && <span style={{ color: "#be123c", fontWeight: 700 }}> ⚠</span>}
            </>
          }
          sub={`${r.typeLabel} · missing ${r.missing.join(", ")}`}
          value={`${r.missing.length}`}
          valueSub={r.missing.length === 1 ? "gap" : "gaps"}
          valueColor={r.blocking ? "#be123c" : "#b45309"}
        />
      ))}

      <ReportActions
        filename="missing-details"
        pdf={() => ({ kind: "missingdetails", rows, totals, asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildMissingDetailsHTML(b, rows, totals, asAtLabel(), w)}
        csv={() => ({
          filename: "missing-details",
          headers: ["Name", "Type", "Missing", "Blocking"],
          rows: rows.map((r) => [r.name, r.typeLabel, r.missing.join("; "), r.blocking ? "yes" : "no"]),
        })}
        share={() => ({
          title: "Missing Details",
          subtitle: `As at ${todayStr()}`,
          lines: rows.map((r) => `${r.name} (${r.typeLabel}): missing ${r.missing.join(", ")}`),
        })}
      />
    </>
  );
}

// Contacts Reports — one tool over Customers and Suppliers. Money per customer
// lives in Sales Reports and money per supplier in Purchases Reports, so this
// one stays about the people.
export function ContactsReportsView() {
  const clients = useToolAccess("clients");
  const suppliers = useToolAccess("suppliers");

  return (
    <ReportsTool
      title="Contacts Reports"
      loading={clients.loading || suppliers.loading}
      tabs={[
        { id: "directory", label: "📇 Directory", show: clients.canView || suppliers.canView, render: () => <DirectoryTab /> },
        { id: "payers", label: "⏱️ Who pays late", show: clients.canView, render: () => <PayersTab /> },
        { id: "dormant", label: "💤 Dormant", show: clients.canView, render: () => <DormantTab /> },
        { id: "missing", label: "⚠️ Missing details", show: clients.canView || suppliers.canView, render: () => <MissingTab /> },
      ]}
    />
  );
}
