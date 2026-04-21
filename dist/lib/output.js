import Table from "cli-table3";
export function formatTable(headers, rows) {
    const table = new Table({
        head: headers,
        style: { head: ["cyan"] },
    });
    table.push(...rows);
    return table.toString();
}
export function outputData(data, format, tableHeaders, tableRows) {
    if (format === "json") {
        console.log(JSON.stringify(data, null, 2));
    }
    else {
        console.log(formatTable(tableHeaders, tableRows));
    }
}
//# sourceMappingURL=output.js.map