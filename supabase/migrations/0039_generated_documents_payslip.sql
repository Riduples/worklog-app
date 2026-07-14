-- archiveGeneratedDocument() writes a generated_documents row for every
-- shared doc kind, including the new "payslip" kind from Pay Run. The
-- existing CHECK only allowed quote/invoice/purchaseorder, so every payslip
-- archive insert failed silently (caught as best-effort in DocumentActions) —
-- the HTML uploaded to Storage but the audit-trail row never got created.
ALTER TABLE generated_documents DROP CONSTRAINT generated_documents_document_type_check;
ALTER TABLE generated_documents ADD CONSTRAINT generated_documents_document_type_check
  CHECK (document_type = ANY (ARRAY['quote'::text, 'invoice'::text, 'purchaseorder'::text, 'payslip'::text]));
