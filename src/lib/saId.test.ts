import { describe, expect, it } from "vitest";
import { dobFromSaId, ageFromSaId } from "./saId";

// SA ID starts YYMMDD. Century pivot: a two-digit year later than the current
// two-digit year is 19xx, otherwise 20xx. The cases below stay well clear of the
// pivot so they hold regardless of the year the suite runs in.
describe("dobFromSaId", () => {
  it("reads a 1900s birth date", () => {
    expect(dobFromSaId("9002154800086")).toBe("1990-02-15");
  });
  it("reads a 2000s birth date", () => {
    expect(dobFromSaId("0102154800086")).toBe("2001-02-15");
  });
  it("tolerates spaces in the ID", () => {
    expect(dobFromSaId("900215 4800 086")).toBe("1990-02-15");
  });
  it("rejects an impossible month", () => {
    expect(dobFromSaId("9013154800086")).toBeNull();
  });
  it("rejects an impossible day (31 Feb)", () => {
    expect(dobFromSaId("9002314800086")).toBeNull();
  });
  it("returns null for a too-short or empty value", () => {
    expect(dobFromSaId("12345")).toBeNull();
    expect(dobFromSaId("")).toBeNull();
    expect(dobFromSaId(null)).toBeNull();
  });
});

describe("ageFromSaId", () => {
  it("computes age as at a reference date, after the birthday", () => {
    expect(ageFromSaId("9002154800086", new Date("2026-07-27"))).toBe(36);
  });
  it("has not yet had this year's birthday", () => {
    expect(ageFromSaId("9002154800086", new Date("2026-01-10"))).toBe(35);
  });
  it("returns null when the ID has no valid date", () => {
    expect(ageFromSaId("nope")).toBeNull();
  });
});
