export const LOGO_BUCKET = "business-logos";

/** 2MB. Mirrors the bucket's own file_size_limit (migration 0056). */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * The Storage path inside a stored logo URL, or null if it isn't one of ours.
 *
 * logo_url holds a full public URL (the schema says "keep URL here"), but
 * deleting needs the path. Rather than parse loosely, this insists the URL
 * points at our bucket AND at the business doing the asking — a value that has
 * been tampered with resolves to null and deletes nothing, instead of aiming a
 * delete at some other tenant's folder.
 */
export function storagePathFromUrl(url: string | null | undefined, businessId: string): string | null {
  if (!url) return null;
  const marker = `/${LOGO_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;

  // Everything after the bucket, minus the cache-busting query.
  const path = url.slice(at + marker.length).split("?")[0];
  if (!path) return null;

  // Must live in this business's own folder. Anything else isn't ours to touch.
  const [folder, ...rest] = path.split("/");
  if (folder !== businessId || rest.length === 0) return null;
  // No traversal, and exactly one level deep — the convention is
  // {business_id}/logo.{ext}.
  if (rest.length > 1 || rest[0].includes("..")) return null;

  return path;
}
