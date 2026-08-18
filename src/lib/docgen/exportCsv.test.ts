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
