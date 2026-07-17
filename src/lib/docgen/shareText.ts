import { fmt } from "@/lib/format";
import { balanceInclVat } from "@/lib/balance";
import type { Quote } from "@/lib/supabase/hooks/useQuotes";
import type { Invoice } from "@/lib/supabase/hooks/useInvoices";

type SalesItem = { desc?: string; qty?: number; labour?: number; materials?: number };

export function buildQuoteText(q: Quote): string {
  const items = (q.line_items as SalesItem[]) ?? [];
  const lines = items
    .filter((i) => i.desc || i.labour || i.materials)
    .map((i) => {
      const parts: string[] = [];
      if (i.desc) parts.push(i.desc);
      if (i.qty && Number(i.qty) > 1) parts.push(`x${i.qty}`);
      const lineTotal = Number(i.labour || 0) + Number(i.materials || 0);
      if (lineTotal > 0) parts.push(fmt(lineTotal));
      return `  • ${parts.join(" — ")}`;
    })
    .join("\n");

  const totalInclVat = Number(q.total_amount) + Number(q.vat_amount ?? 0);

  return [
    `📋 *QUOTE ${q.doc_number}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `*Client:* ${q.client_name}`,
    `*Date:* ${q.issue_date}`,
    ``,
    `*Items:*`,
    lines || `  • (no items)`,
    ``,
    `━━━━━━━━━━━━━━━━━━━`,
    Number(q.deposit_requested) > 0 ? `*Deposit required:* ${fmt(q.deposit_requested)}` : null,
    `*TOTAL: ${fmt(totalInclVat)}*`,
    ``,
    q.valid_until ? `_This quote is valid until ${q.valid_until}._` : `_This quote is valid for 30 days._`,
    `_Reply to accept or ask any questions._`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function buildInvoiceText(inv: Invoice): string {
  const totalInclVat = Number(inv.invoice_amount) + Number(inv.vat_amount ?? 0);
  // This goes to the customer. The naive sum meant a settled invoice's WhatsApp
  // message announced a balance of exactly the VAT — while the same modal that
  // sends it showed R 0.00 on screen, because that one had the guard.
  const balanceDue = balanceInclVat(inv.balance_due, inv.vat_amount);

  return [
    `📄 *INVOICE ${inv.doc_number}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `*Client:* ${inv.client_name}`,
    `*Invoice date:* ${inv.issue_date}`,
    inv.due_date ? `*Due date:* ${inv.due_date}` : null,
    ``,
    `━━━━━━━━━━━━━━━━━━━`,
    `*Invoice amount:* ${fmt(totalInclVat)}`,
    Number(inv.deposit_received) > 0 ? `*Deposit received:* ${fmt(inv.deposit_received)}` : null,
    `*BALANCE DUE: ${fmt(balanceDue)}*`,
    ``,
    `_Please make payment by the due date._`,
    `_Thank you for your business!_`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
