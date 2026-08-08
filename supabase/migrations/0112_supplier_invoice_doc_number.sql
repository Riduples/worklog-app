-- 0112: give supplier invoices our own internal bill number.
--
-- Until now a supplier invoice only carried supplier_ref_number — the number the
-- supplier prints on their own document. Every supplier numbers differently, so
-- that field is not a sortable sequence and can't act as an internal reference.
-- This adds a doc_number column that is *ours*: an SI-YYYY-NNNN series minted per
-- business by getNextDocNumber (see src/lib/docNumber.ts), exactly like invoices
-- (INV-), quotes (QTE-) and purchase orders (PO-). supplier_ref_number stays as
-- the supplier's own reference, shown alongside.
--
-- Additive and nullable — no RLS change (row visibility is unchanged). Existing
-- rows are backfilled below so nothing is left blank.

ALTER TABLE supplier_invoices ADD COLUMN doc_number text;

-- Backfill existing bills with a per-business, per-year sequence ordered by the
-- invoice date (then created_at/id to break ties deterministically), matching the
-- SI-YYYY-NNNN shape and the reset-per-year behaviour of getNextDocNumber, so new
-- bills continue cleanly from the highest number in the current year.
WITH numbered AS (
  SELECT
    id,
    'SI-' || EXTRACT(YEAR FROM issue_date)::int || '-' ||
    LPAD(
      (ROW_NUMBER() OVER (
        PARTITION BY business_id, EXTRACT(YEAR FROM issue_date)
        ORDER BY issue_date, created_at, id
      ))::text, 4, '0'
    ) AS new_doc_number
  FROM supplier_invoices
  WHERE deleted_at IS NULL
)
UPDATE supplier_invoices s
SET doc_number = n.new_doc_number
FROM numbered n
WHERE s.id = n.id;
