-- Storage for business logos.
--
-- Public, deliberately, and this diverges from the build spec's "logos,
-- receipts, bank statements (private buckets, signed URLs)". Two reasons:
--
--   * A logo is not private. It is printed on every quote and invoice the
--     business sends to customers. Guarding the copy in Storage while posting
--     the same image to every customer protects nothing.
--   * worklog-schema.sql says logo_url should "store in Supabase Storage, keep
--     URL here" — and you cannot keep a signed URL, it expires. A stored URL
--     implies a stable public one.
--
-- Receipts and bank statements are a different matter and stay private; that
-- part of the spec is about them. generated-documents is already private and
-- stays that way — those contain the financial data.
--
-- Writes are still locked to the owning business: public read, not public write.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos', 'business-logos', true,
  2097152,  -- 2MB. A letterhead logo has no business being larger, and the
            -- limit is enforced here rather than only in the client.
  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'];

-- Path convention: {business_id}/logo.{ext}, so the first folder segment is the
-- tenant and RLS can key off it exactly as the generated-documents bucket does.
DROP POLICY IF EXISTS "business logos are readable by anyone" ON storage.objects;
CREATE POLICY "business logos are readable by anyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-logos');

DROP POLICY IF EXISTS "members write their own business logo" ON storage.objects;
CREATE POLICY "members write their own business logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-logos'
    AND is_business_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "members update their own business logo" ON storage.objects;
CREATE POLICY "members update their own business logo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'business-logos'
    AND is_business_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "members remove their own business logo" ON storage.objects;
CREATE POLICY "members remove their own business logo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-logos'
    AND is_business_member((storage.foldername(name))[1]::uuid)
  );
