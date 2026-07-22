"use client";

import { ToolTile } from "@/components/dashboard/ToolTile";
import { useToolGate } from "@/lib/useToolGate";
import { type ToolId } from "@/lib/permissions";

// The full, permission- and business-type-gated tool list. Shared by the
// dashboard's "All my tools" and the mobile tab bar's "More" sheet so the two can
// never drift. A locked tile hands its tool id back via onLockedClick — the
// dashboard opens its UpgradeModal, the tab bar routes to /dashboard?upgrade=.
export function AllToolsGrid({ onLockedClick }: { onLockedClick: (tool: ToolId) => void }) {
  const { isOwner, gate, tierLocked } = useToolGate();

  return (
    <>
      <div className="tool-grid">
        {(gate("clients") || gate("suppliers")) && <ToolTile href="/contacts" icon="👥" label="Contacts" />}
        {gate("stock") && <ToolTile href="/stock" icon="📦" label="Stock" />}
        {gate("quote") && <ToolTile href="/quotes" icon="📋" label="Quotes" />}
        {gate("invoice") && <ToolTile href="/invoices" icon="📤" label="Invoices" />}
        {gate("statement") && (
          <ToolTile href="/statement" icon="📃" label="Statements" locked={tierLocked("statement")} onLockedClick={() => onLockedClick("statement")} />
        )}
        {gate("bankstatement") && <ToolTile href="/bank-statement" icon="🏦" label="Import Statement" />}
        {gate("cashup") && <ToolTile href="/cash-up" icon="🧮" label="Daily Cash-Up" />}
        {isOwner && <ToolTile href="/accounts" icon="💳" label="Bank Accounts" />}
        {gate("purchaseorder") && (
          <ToolTile href="/purchase-orders" icon="🛒" label="Purchase Orders" locked={tierLocked("purchaseorder")} onLockedClick={() => onLockedClick("purchaseorder")} />
        )}
        {gate("supplierinvoice") && (
          <ToolTile href="/supplier-invoices" icon="📥" label="Supplier Invoices" locked={tierLocked("supplierinvoice")} onLockedClick={() => onLockedClick("supplierinvoice")} />
        )}
        {gate("remittance") && (
          <ToolTile href="/remittance" icon="🧾" label="Remittance" locked={tierLocked("remittance")} onLockedClick={() => onLockedClick("remittance")} />
        )}
        {gate("recipe") && <ToolTile href="/recipes" icon="🍳" label="Cost Calculator" />}
        {gate("booking") && <ToolTile href="/bookings" icon="📅" label="Bookings" />}
        {gate("timetrack") && <ToolTile href="/time" icon="⏱️" label="Time Tracker" />}
        {gate("mileage") && <ToolTile href="/mileage" icon="🚗" label="Mileage" />}
        {gate("ledger") && <ToolTile href="/ledger" icon="📒" label="Ledgers" />}
        {isOwner && <ToolTile href="/team" icon="👤" label="Team" />}
      </div>

      {(gate("staffregister") || gate("payrun") || gate("advances") || gate("leave")) && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "14px 0 10px" }}>Payroll</div>
          <div className="tool-grid">
            {gate("staffregister") && (
              <ToolTile href="/staff" icon="👤" label="Staff Register" locked={tierLocked("staffregister")} onLockedClick={() => onLockedClick("staffregister")} />
            )}
            {gate("payrun") && <ToolTile href="/payroll" icon="💵" label="Pay Run" locked={tierLocked("payrun")} onLockedClick={() => onLockedClick("payrun")} />}
            {gate("advances") && <ToolTile href="/advances" icon="💰" label="Advances" locked={tierLocked("advances")} onLockedClick={() => onLockedClick("advances")} />}
            {gate("leave") && <ToolTile href="/leave" icon="🏖️" label="Leave" locked={tierLocked("leave")} onLockedClick={() => onLockedClick("leave")} />}
          </div>
        </>
      )}

      {(gate("tax") || gate("profit") || gate("profitloss") || gate("ageanalysis")) && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "14px 0 10px" }}>Reports</div>
          <div className="tool-grid">
            {gate("tax") && <ToolTile href="/tax" icon="🧾" label="Tax & SARS" />}
            {gate("profit") && <ToolTile href="/cashflow" icon="📊" label="Cash Flow" />}
            {gate("profitloss") && <ToolTile href="/profit-loss" icon="📈" label="Profit & Loss" />}
            {gate("ageanalysis") && (
              <ToolTile href="/age-analysis" icon="⏳" label="Age Analysis" locked={tierLocked("ageanalysis")} onLockedClick={() => onLockedClick("ageanalysis")} />
            )}
          </div>
        </>
      )}
    </>
  );
}
