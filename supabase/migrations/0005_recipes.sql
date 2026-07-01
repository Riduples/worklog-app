CREATE TABLE recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_name       TEXT NOT NULL,
  servings        NUMERIC(8,2) NOT NULL DEFAULT 1,
  ingredients     JSONB NOT NULL DEFAULT '[]',
  total_cost      NUMERIC(12,2),
  cost_per_serving NUMERIC(12,2),
  suggested_price NUMERIC(12,2),
  markup_pct      NUMERIC(5,2) DEFAULT 60,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON recipes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
