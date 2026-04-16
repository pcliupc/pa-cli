import Table from "cli-table3";

export type OutputFormat = "table" | "json";

export function formatTable(headers: string[], rows: string[][]): string {
  const table = new Table({
    head: headers,
    style: { head: ["cyan"] },
  });
  table.push(...rows);
  return table.toString();
}

export function outputData<T>(
  data: T,
  format: OutputFormat,
  tableHeaders: string[],
  tableRows: string[][],
): void {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatTable(tableHeaders, tableRows));
  }
}
