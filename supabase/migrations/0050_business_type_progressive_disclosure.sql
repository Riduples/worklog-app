-- Progressive disclosure (worklog-schema.sql: businesses.business_type +
-- show_all_tools). The build spec calls this "a core part of the market fit"
-- and asks for it to be preserved exactly: a salon shouldn't have to scroll
-- past Purchase Orders to find its till.
--
-- This only ever HIDES tools from the home screen. Nothing is locked, no data
-- is touched, and "show every tool" restores the full set -- which is why
-- there is no CHECK constraint tying business_type to a fixed list beyond the
-- known ids: an unrecognised value simply means "no filtering", matching the
-- prototype (BUSINESS_TYPE_CORE_TOOLS[undefined] -> undefined -> show all).
--
-- Both columns are nullable/defaulted so every existing business keeps seeing
-- exactly what it sees today until its owner picks a type.
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS show_all_tools boolean NOT NULL DEFAULT false;

ALTER TABLE business_profiles
  DROP CONSTRAINT IF EXISTS business_profiles_business_type_check;
ALTER TABLE business_profiles
  ADD CONSTRAINT business_profiles_business_type_check
  CHECK (business_type IS NULL OR business_type IN
    ('salon','retail','food','trade','cleaning','freelance','other'));
