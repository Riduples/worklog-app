-- Harden the PUBLIC business-logos bucket: drop image/svg+xml from the allowed
-- MIME types (keep png/jpeg/webp).
--
-- An SVG can carry inline <script>, and this bucket is public, so a crafted logo
-- opened directly (or embedded via <object>/<iframe>) would execute script on
-- the storage origin — a stored-XSS foothold. Logos only ever need raster
-- formats; restricting the allow-list means even SVG bytes uploaded under a
-- spoofed content-type are served as the declared raster type (non-executable).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'business-logos';
