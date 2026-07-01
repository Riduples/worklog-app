CREATE TABLE business_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT,
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  vat_number      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON business_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON business_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON business_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
