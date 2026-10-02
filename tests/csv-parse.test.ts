import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv-parse";
import { toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses headers case-insensitively into objects", () => {
    expect(parseCsv("Name,SKU\nWhey,W-1\nOmega,O-2")).toEqual([
      { name: "Whey", sku: "W-1" },
      { name: "Omega", sku: "O-2" },
    ]);
  });

  it("handles quotes, commas, escaped quotes, newlines in cells, CRLF and BOM", () => {
    const text = '\uFEFFname,description\r\n"A, B","He said ""hi""\nsecond line"\r\n';
    expect(parseCsv(text)).toEqual([{ name: "A, B", description: 'He said "hi"\nsecond line' }]);
  });

  it("skips blank lines and returns [] without data rows", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([{ a: "1", b: "2" }]);
    expect(parseCsv("a,b")).toEqual([]);
    expect(parseCsv("")).toEqual([]);
  });

  it("round-trips what toCsv writes", () => {
    const csv = toCsv(["name", "note"], [["x,y", 'q"uote'], ["plain", ""]]);
    expect(parseCsv(csv)).toEqual([
      { name: "x,y", note: 'q"uote' },
      { name: "plain", note: "" },
    ]);
  });
});
