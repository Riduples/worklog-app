import { describe, expect, it } from "vitest";
import { pdfIsEncrypted } from "./decryptStatement";

const bytesOf = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("pdfIsEncrypted", () => {
  it("finds the /Encrypt trailer reference of a protected PDF", () => {
    // The trailer of an encrypted PDF names the encryption dictionary. The key is
    // always in clear bytes — encryption never touches the dictionary structure.
    const pdf = bytesOf("%PDF-1.6\n...\ntrailer\n<< /Size 42 /Root 1 0 R /Encrypt 40 0 R >>\nstartxref\n1234\n%%EOF");
    expect(pdfIsEncrypted(pdf)).toBe(true);
  });

  it("returns false for an unencrypted PDF", () => {
    const pdf = bytesOf("%PDF-1.4\n...\ntrailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n999\n%%EOF");
    expect(pdfIsEncrypted(pdf)).toBe(false);
  });

  it("finds the marker even when it sits at the very end of the buffer", () => {
    expect(pdfIsEncrypted(bytesOf("some bytes then /Encrypt"))).toBe(true);
  });

  it("does not false-match a truncated marker", () => {
    // "/Encryp" (missing the final t) must not count — it's not the real key.
    expect(pdfIsEncrypted(bytesOf("<< /Encryp 40 0 R >>"))).toBe(false);
  });

  it("handles an empty buffer", () => {
    expect(pdfIsEncrypted(new Uint8Array(0))).toBe(false);
  });
});
