CREATE TABLE stock_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  qty             INTEGER NOT NULL DEFAULT 0,
  cost_price      NUMERIC(12,2) DEFAULT 0,
  sell_price      NUMERIC(12,2) DEFAULT 0,
  reorder_level   INTEGER DEFAULT 0,
  margin_pct      NUMERIC(5,2),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stock_user ON stock_items(user_id);

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON stock_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON stock_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON stock_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
