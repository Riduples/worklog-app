ALTER TABLE quotes ADD COLUMN vat_rate NUMERIC(5,4);
ALTER TABLE quotes ADD COLUMN vat_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE invoices ADD COLUMN vat_rate NUMERIC(5,4);
ALTER TABLE invoices ADD COLUMN vat_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE purchase_orders ADD COLUMN vat_rate NUMERIC(5,4);
ALTER TABLE purchase_orders ADD COLUMN vat_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE supplier_invoices ADD COLUMN vat_rate NUMERIC(5,4);
ALTER TABLE supplier_invoices ADD COLUMN vat_amount NUMERIC(12,2) DEFAULT 0;
