-- Banking details and logo (worklog-schema.sql: businesses.bank_name /
-- bank_account / bank_branch / bank_ref, "(shown on invoices/quotes)", plus
-- logo_url "store in Supabase Storage, keep URL here (was base64 inline)").
--
-- These exist in the prototype (worklog-v65.jsx:414-425 renders a "Payment
-- Details" block) but were never ported, so a WORKLOG invoice has been telling
-- customers what they owe and not where to send it. The footer literally reads
-- "Please make payment by the due date above" with no account number anywhere.
--
-- All nullable: a business with no banking captured renders exactly as it does
-- today. The document only shows the block once there is something to show.
--
-- logo_url is added here but not yet used; the upload path lands separately.
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS bank_ref text,
  ADD COLUMN IF NOT EXISTS logo_url text;
