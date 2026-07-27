-- 0087 (Phase E1): supplier banking details on contacts.
--
-- You pay suppliers often; previously their banking details had nowhere to live
-- but the notes field. Two optional fields on the contact (used for suppliers) —
-- captured with a POPIA note since third-party banking data is sensitive.
-- Nullable + additive: existing contacts are unaffected.

ALTER TABLE contacts
  ADD COLUMN bank_name text,
  ADD COLUMN account_number text;
