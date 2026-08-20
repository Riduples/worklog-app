-- 0121: make document numbering race-safe.
--
-- getNextDocNumber (src/lib/docNumber.ts) reads the highest existing number for a
-- business/prefix/year from the CLIENT and adds one. Two team members creating an
-- invoice in the same moment read the same maximum and are handed the same
-- number, and nothing stops the second write — there is no unique index on
-- invoices.doc_number, so both save and the business has two INV-2026-0007.
--
-- The read-then-write is the whole problem, and it does not go away by moving it
-- into the database: create_pay_run (0083) computes MAX(payslip_number) + 1
-- server-side and two concurrent transactions can still read the same maximum
-- there. What saves it is a unique index, which turns the collision into an error
-- rather than a correct number.
--
-- A counter row fixes it properly. INSERT ... ON CONFLICT DO UPDATE ... RETURNING
-- is a single statement, so it takes a row lock and the second caller waits and
-- reads the incremented value. No read-then-write, no window, and it hands out a
-- contiguous block for batch callers (the CSV import numbers everyone in one go).

CREATE TABLE doc_sequences (
  business_id  uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  -- QTE / INV / PO / CN / SI / EMP — the series, matching SERIES in docNumber.ts.
  prefix       text NOT NULL,
  -- Numbers reset each calendar year, which is what getNextDocNumber already did
  -- by filtering on a 'PREFIX-YYYY-' pattern. Keeping the year in the key makes
  -- that reset a fact of the schema rather than a property of a LIKE filter.
  year         int  NOT NULL,
  -- The last number handed out. The next caller gets last_number + 1.
  last_number  int  NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (business_id, prefix, year)
);

ALTER TABLE doc_sequences ENABLE ROW LEVEL SECURITY;

-- Tenancy only, deliberately not has_tool_access. Six different tools mint
-- numbers from this one table, so gating on any single tool would block a member
-- who is legitimately creating a document of another kind. The row carries no
-- business data — just a counter — so membership is the right boundary.
CREATE POLICY "select_member" ON doc_sequences FOR SELECT
  USING (is_business_member(business_id));
CREATE POLICY "insert_member" ON doc_sequences FOR INSERT
  WITH CHECK (is_business_member(business_id));
CREATE POLICY "update_member" ON doc_sequences FOR UPDATE
  USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));

-- Seed from what each series has already issued, so numbering continues instead
-- of restarting at 1 and colliding with every document already on file. Reads the
-- trailing digits of the existing numbers, exactly as getNextDocNumber did.
--
-- Soft-deleted rows are counted deliberately (no deleted_at filter). A deleted
-- invoice still consumed its number, and under the old code deleting the newest
-- one lowered the maximum so the next document reused it — pointing two documents
-- at one number. A counter only ever moves forward, so a deleted number is spent
-- for good. Gaps in the series are the correct outcome, not a defect.
INSERT INTO doc_sequences (business_id, prefix, year, last_number)
SELECT business_id, prefix, year, MAX(n)
FROM (
  SELECT business_id, 'QTE' AS prefix,
         (regexp_match(doc_number, '^QTE-(\d{4})-'))[1]::int AS year,
         (regexp_match(doc_number, '(\d+)$'))[1]::int        AS n
  FROM quotes WHERE doc_number ~ '^QTE-\d{4}-\d+$'
  UNION ALL
  SELECT business_id, 'INV',
         (regexp_match(doc_number, '^INV-(\d{4})-'))[1]::int,
         (regexp_match(doc_number, '(\d+)$'))[1]::int
  FROM invoices WHERE doc_number ~ '^INV-\d{4}-\d+$'
  UNION ALL
  SELECT business_id, 'PO',
         (regexp_match(doc_number, '^PO-(\d{4})-'))[1]::int,
         (regexp_match(doc_number, '(\d+)$'))[1]::int
  FROM purchase_orders WHERE doc_number ~ '^PO-\d{4}-\d+$'
  UNION ALL
  SELECT business_id, 'CN',
         (regexp_match(doc_number, '^CN-(\d{4})-'))[1]::int,
         (regexp_match(doc_number, '(\d+)$'))[1]::int
  FROM credit_notes WHERE doc_number ~ '^CN-\d{4}-\d+$'
  UNION ALL
  SELECT business_id, 'SI',
         (regexp_match(doc_number, '^SI-(\d{4})-'))[1]::int,
         (regexp_match(doc_number, '(\d+)$'))[1]::int
  FROM supplier_invoices WHERE doc_number ~ '^SI-\d{4}-\d+$'
  UNION ALL
  SELECT business_id, 'EMP',
         (regexp_match(employee_number, '^EMP-(\d{4})-'))[1]::int,
         (regexp_match(employee_number, '(\d+)$'))[1]::int
  FROM staff_register WHERE employee_number ~ '^EMP-\d{4}-\d+$'
) AS issued
GROUP BY business_id, prefix, year;

-- Reserve `p_count` numbers and return the LAST one reserved; the caller counts
-- back for the rest of the block. One statement, so the row lock it takes is held
-- until commit and a concurrent caller reads the already-incremented value.
--
-- SECURITY INVOKER, so the RLS policies above apply and a caller can only mint
-- numbers for a business they belong to. search_path is pinned empty and the
-- table reference schema-qualified, as every function since 0091 is — the
-- ON CONFLICT target is still named `doc_sequences` because that clause refers
-- to the insert target by its bare name, and now() is in pg_catalog, which is
-- searched regardless.
CREATE OR REPLACE FUNCTION reserve_doc_numbers(
  p_business_id uuid,
  p_prefix text,
  p_year int,
  p_count int
)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_last int;
BEGIN
  IF p_count < 1 OR p_count > 5000 THEN
    RAISE EXCEPTION 'Invalid count';
  END IF;
  IF p_prefix NOT IN ('QTE', 'INV', 'PO', 'CN', 'SI', 'EMP') THEN
    RAISE EXCEPTION 'Unknown series %', p_prefix;
  END IF;

  INSERT INTO public.doc_sequences (business_id, prefix, year, last_number)
  VALUES (p_business_id, p_prefix, p_year, p_count)
  ON CONFLICT (business_id, prefix, year) DO UPDATE
    SET last_number = doc_sequences.last_number + p_count,
        updated_at  = now()
  RETURNING last_number INTO v_last;

  RETURN v_last;
END;
$$;

REVOKE EXECUTE ON FUNCTION reserve_doc_numbers(uuid, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reserve_doc_numbers(uuid, text, int, int) TO authenticated;
