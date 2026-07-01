INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-documents', 'generated-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "select_own_docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "insert_own_docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'generated-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "update_own_docs" ON storage.objects FOR UPDATE
  USING (bucket_id = 'generated-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'generated-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
