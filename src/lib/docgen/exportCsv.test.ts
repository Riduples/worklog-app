import { describe, expect, it } from "vitest";
import { buildCsv } from "./exportCsv";

// The BOM Excel needs to read UTF-8; every test strips it before asserting on
// the rows so the payload assertions stay readable.
const BOM = "﻿";
const rows = (csv: string) => csv.replace(BOM, "").split("\r\n");

describe("buildCsv", () => {
  it("prepends a UTF-8 BOM and joins with CRLF", () => {
    const csv = buildCsv(["A", "B"], [["1", "2"]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(rows(csv)).toEqual(["A,B", "1,2"]);
  });

  it("quotes fields with commas, quotes or newlines and doubles inner quotes", () => {
    const csv = buildCsv(["Name", "Note"], [["Acme, Ltd", 'He said "hi"'], ["plain", "line1\nline2"]]);
    expect(rows(csv)).toEqual([
      "Name,Note",
      '"Acme, Ltd","He said ""hi"""',
      'plain,"line1\nline2"',
    ]);
  });

  it("renders numbers unformatted and empty for null/undefined", () => {
    const csv = buildCsv(["Item", "Qty", "Price"], [["Widget", 3, 1200.5], ["Gap", null, undefined]]);
    expect(rows(csv)).toEqual(["Item,Qty,Price", "Widget,3,1200.5", "Gap,,"]);
  });
});

// A spreadsheet runs a cell that opens with =, +, - or @, so an export carrying
// a customer's name straight through is a way to hand someone else's machine a
// formula. The interesting half is what must NOT be escaped: these files exist
// to be added up, so a negative total has to survive as a number.
describe("buildCsv formula injection", () => {
  it("neutralises cells that open with a formula character", () => {
    const csv = buildCsv(["Name"], [["=1+1"], ["+cmd"], ["@SUM(A1)"]]);
    expect(rows(csv)).toEqual(["Name", "'=1+1", "'+cmd", "'@SUM(A1)"]);
  });

  it("leaves negative numbers alone so the column still sums", () => {
    // The whole reason this can't be a blanket "starts with -" rule.
    const csv = buildCsv(["Amount"], [["-1500.00"], [-1500.5], [-42]]);
    expect(rows(csv)).toEqual(["Amount", "-1500.00", "-1500.5", "-42"]);
  });

  it("still neutralises something that only looks like a negative number", () => {
    const csv = buildCsv(["Amount"], [["-1500=SUM(A1)"], ["-1+1"]]);
    expect(rows(csv)).toEqual(["Amount", "'-1500=SUM(A1)", "'-1+1"]);
  });

  it("quotes and neutralises together when the payload also holds a comma", () => {
    const csv = buildCsv(["Name"], [['=HYPERLINK("http://x","click")']]);
    expect(rows(csv)).toEqual(["Name", `"'=HYPERLINK(""http://x"",""click"")"`]);
  });

  it("does not touch an ordinary name or a plain figure", () => {
    const csv = buildCsv(["Name", "Amount"], [["Acme Ltd", "1200.50"]]);
    expect(rows(csv)).toEqual(["Name,Amount", "Acme Ltd,1200.50"]);
  });
});
