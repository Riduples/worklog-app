-- 0090 (Phase E4): job costing on a materials + labour model.
--
-- The "Cost Calculator" was still the old food-recipe tool (dish/servings/
-- ingredients on the recipes table). This is the trade job-costing tool it should
-- be: cost a job/product from material and labour lines, see the total cost +
-- suggested price, and save the result back to your price list. New table so the
-- old recipes data stays frozen and untouched.
--
-- lines JSONB shape: [{ kind: 'material'|'labour', desc, qty, unit_cost }]. Labour
-- lines' qty is hours, so labour_hours = sum of qty on labour lines (feeds a
-- quote's estimated hours). Business-scoped RLS like every other v2 table.

CREATE TABLE costings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]',
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  markup_pct numeric(5,2) NOT NULL DEFAULT 50,
  suggested_price numeric(12,2) NOT NULL DEFAULT 0,
  labour_hours numeric(8,2) NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_costings_business ON costings(business_id);

ALTER TABLE costings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_member" ON costings FOR SELECT
  USING (is_business_member(business_id));
CREATE POLICY "insert_member" ON costings FOR INSERT
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));
CREATE POLICY "update_member" ON costings FOR UPDATE
  USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));
