import { describe, it, expect } from "vitest";
import { formatTable } from "../../src/lib/output.js";

describe("formatTable", () => {
  it("formats rows into table string", () => {
    const headers = ["ID", "Name", "Active"];
    const rows = [
      ["demo", "Demo Agent", "✓"],
      ["writer", "Writer Agent", "✓"],
    ];
    const result = formatTable(headers, rows);
    expect(result).toContain("ID");
    expect(result).toContain("demo");
    expect(result).toContain("Writer Agent");
  });

  it("handles empty rows", () => {
    const result = formatTable(["ID", "Name"], []);
    expect(result).toContain("ID");
    expect(result).toContain("Name");
  });
});
