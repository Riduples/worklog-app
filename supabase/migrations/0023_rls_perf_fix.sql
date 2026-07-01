-- user_profiles (PK doubles as the auth.uid() match column)
DROP POLICY "select_own" ON user_profiles;
DROP POLICY "insert_own" ON user_profiles;
DROP POLICY "update_own" ON user_profiles;
CREATE POLICY "select_own" ON user_profiles FOR SELECT USING ((select auth.uid()) = id);
CREATE POLICY "insert_own" ON user_profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "update_own" ON user_profiles FOR UPDATE USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

-- business_profiles
DROP POLICY "select_own" ON business_profiles;
DROP POLICY "insert_own" ON business_profiles;
DROP POLICY "update_own" ON business_profiles;
CREATE POLICY "select_own" ON business_profiles FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON business_profiles FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON business_profiles FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- contacts
DROP POLICY "select_own" ON contacts;
DROP POLICY "insert_own" ON contacts;
DROP POLICY "update_own" ON contacts;
CREATE POLICY "select_own" ON contacts FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON contacts FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON contacts FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- stock_items
DROP POLICY "select_own" ON stock_items;
DROP POLICY "insert_own" ON stock_items;
DROP POLICY "update_own" ON stock_items;
CREATE POLICY "select_own" ON stock_items FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON stock_items FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON stock_items FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- recipes
DROP POLICY "select_own" ON recipes;
DROP POLICY "insert_own" ON recipes;
DROP POLICY "update_own" ON recipes;
CREATE POLICY "select_own" ON recipes FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON recipes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON recipes FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- quotes
DROP POLICY "select_own" ON quotes;
DROP POLICY "insert_own" ON quotes;
DROP POLICY "update_own" ON quotes;
CREATE POLICY "select_own" ON quotes FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON quotes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON quotes FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- invoices
DROP POLICY "select_own" ON invoices;
DROP POLICY "insert_own" ON invoices;
DROP POLICY "update_own" ON invoices;
CREATE POLICY "select_own" ON invoices FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON invoices FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON invoices FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- purchase_orders
DROP POLICY "select_own" ON purchase_orders;
DROP POLICY "insert_own" ON purchase_orders;
DROP POLICY "update_own" ON purchase_orders;
CREATE POLICY "select_own" ON purchase_orders FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON purchase_orders FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON purchase_orders FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- supplier_invoices
DROP POLICY "select_own" ON supplier_invoices;
DROP POLICY "insert_own" ON supplier_invoices;
DROP POLICY "update_own" ON supplier_invoices;
CREATE POLICY "select_own" ON supplier_invoices FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON supplier_invoices FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON supplier_invoices FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- income
DROP POLICY "select_own" ON income;
DROP POLICY "insert_own" ON income;
DROP POLICY "update_own" ON income;
CREATE POLICY "select_own" ON income FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON income FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON income FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- expenses
DROP POLICY "select_own" ON expenses;
DROP POLICY "insert_own" ON expenses;
DROP POLICY "update_own" ON expenses;
CREATE POLICY "select_own" ON expenses FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON expenses FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON expenses FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- mileage_trips
DROP POLICY "select_own" ON mileage_trips;
DROP POLICY "insert_own" ON mileage_trips;
DROP POLICY "update_own" ON mileage_trips;
CREATE POLICY "select_own" ON mileage_trips FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON mileage_trips FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON mileage_trips FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- time_entries
DROP POLICY "select_own" ON time_entries;
DROP POLICY "insert_own" ON time_entries;
DROP POLICY "update_own" ON time_entries;
CREATE POLICY "select_own" ON time_entries FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON time_entries FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON time_entries FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- bookings
DROP POLICY "select_own" ON bookings;
DROP POLICY "insert_own" ON bookings;
DROP POLICY "update_own" ON bookings;
CREATE POLICY "select_own" ON bookings FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON bookings FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON bookings FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- worker_payments
DROP POLICY "select_own" ON worker_payments;
DROP POLICY "insert_own" ON worker_payments;
DROP POLICY "update_own" ON worker_payments;
CREATE POLICY "select_own" ON worker_payments FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON worker_payments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON worker_payments FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- chair_rentals
DROP POLICY "select_own" ON chair_rentals;
DROP POLICY "insert_own" ON chair_rentals;
DROP POLICY "update_own" ON chair_rentals;
CREATE POLICY "select_own" ON chair_rentals FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON chair_rentals FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON chair_rentals FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- ledger_entries
DROP POLICY "select_own" ON ledger_entries;
DROP POLICY "insert_own" ON ledger_entries;
DROP POLICY "update_own" ON ledger_entries;
CREATE POLICY "select_own" ON ledger_entries FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON ledger_entries FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON ledger_entries FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- tax_records
DROP POLICY "select_own" ON tax_records;
DROP POLICY "insert_own" ON tax_records;
DROP POLICY "update_own" ON tax_records;
CREATE POLICY "select_own" ON tax_records FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON tax_records FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON tax_records FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- generated_documents
DROP POLICY "select_own" ON generated_documents;
DROP POLICY "insert_own" ON generated_documents;
DROP POLICY "update_own" ON generated_documents;
CREATE POLICY "select_own" ON generated_documents FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON generated_documents FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON generated_documents FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
