-- 0120: SARS categories on price-list items and contacts.
--
-- Today only a loose income/expense row carries a sars_category. Every document
-- that generates a number — invoice, supplier invoice, ledger entry, credit note
-- — carries none, and the money row's category is deliberately nulled when it is
-- matched to one of them ("a matched payment is described by the invoice it
-- settles"). That reasoning is right; the problem is the invoice has nothing to
-- describe it with. So the more properly a business uses the app, the less
-- categorised its books become: invoice everything and the P&L breakdown is
-- empty, log scrappy cash and it fills up.
--
-- These two columns are where the fix starts, and they are deliberately NOT on
-- the documents. A price-list item is inherently one revenue category — a haircut
-- is a service rendered, a bag of cement is a sale of goods — so putting it on the
-- item means an invoice inherits per line and nobody picks anything while
-- invoicing. An invoice mixing labour and materials then carries both categories
-- correctly, which a single field on the invoice could never do.
--
-- The contact default does the same for the cost side: the same supplier almost
-- always maps to the same category, and most small businesses buy from a dozen
-- repeat suppliers, so one default per supplier categorises the bulk of spend.
--
-- Both additive and nullable — existing rows read as uncategorised rather than
-- being guessed into somewhere wrong, and no RLS changes (row visibility on both
-- tables is unchanged).

-- What this item sells under. Values are the `sars` field of SARS_INCOME_CATEGORIES
-- in src/lib/sarsCategories.ts, e.g. 'Trading income — Services rendered'. Free
-- text rather than an enum: the category list ships in application code and is
-- revised as SARS guidance changes, so a DB constraint would need a migration
-- every time the list moves.
ALTER TABLE stock_items ADD COLUMN sars_category text;

-- The category to reach for when money moves against this contact. Read from
-- SARS_INCOME_CATEGORIES for a customer (contact_type = 'client') and from
-- SARS_CATEGORIES for a supplier — one column, because a contact is one or the
-- other and never both.
ALTER TABLE contacts ADD COLUMN default_sars_category text;
