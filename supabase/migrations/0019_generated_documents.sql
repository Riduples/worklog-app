CREATE TABLE generated_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL
                  CHECK (document_type IN ('quote', 'invoice', 'purchaseorder')),
  source_id       UUID NOT NULL,
  file_path       TEXT NOT NULL,
  file_url        TEXT,
  generated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_docs_source ON generated_documents(source_id);

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON generated_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON generated_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON generated_documents FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
