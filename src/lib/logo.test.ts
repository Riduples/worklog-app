import { describe, expect, it } from "vitest";
import { storagePathFromUrl } from "./logo";

const BIZ = "2403c966-237f-4ddc-a9bc-207737f61a3c";
const OTHER = "11111111-2222-3333-4444-555555555555";
const base = "https://abc.supabase.co/storage/v1/object/public/business-logos";

describe("storagePathFromUrl", () => {
  it("pulls the path out of a stored logo URL", () => {
    expect(storagePathFromUrl(`${base}/${BIZ}/logo.png`, BIZ)).toBe(`${BIZ}/logo.png`);
  });

  it("drops the cache-busting query", () => {
    expect(storagePathFromUrl(`${base}/${BIZ}/logo.png?v=1784267597179`, BIZ)).toBe(`${BIZ}/logo.png`);
  });

  it("refuses another business's folder", () => {
    // The path feeds a delete. Without this, a tampered logo_url could aim it
    // at someone else's logo.
    expect(storagePathFromUrl(`${base}/${OTHER}/logo.png`, BIZ)).toBeNull();
  });

  it("refuses a URL that isn't in our bucket", () => {
    expect(storagePathFromUrl(`https://evil.test/${BIZ}/logo.png`, BIZ)).toBeNull();
    expect(storagePathFromUrl(`https://abc.supabase.co/storage/v1/object/public/generated-documents/${BIZ}/x.html`, BIZ)).toBeNull();
  });

  it("refuses traversal and deeper paths", () => {
    expect(storagePathFromUrl(`${base}/${BIZ}/../${OTHER}/logo.png`, BIZ)).toBeNull();
    expect(storagePathFromUrl(`${base}/${BIZ}/nested/logo.png`, BIZ)).toBeNull();
  });

  it("is null for nothing", () => {
    expect(storagePathFromUrl(null, BIZ)).toBeNull();
    expect(storagePathFromUrl("", BIZ)).toBeNull();
    expect(storagePathFromUrl(`${base}/`, BIZ)).toBeNull();
  });
});
