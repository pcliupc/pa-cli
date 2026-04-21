export type OutputFormat = "table" | "json";
export declare function formatTable(headers: string[], rows: string[][]): string;
export declare function outputData<T>(data: T, format: OutputFormat, tableHeaders: string[], tableRows: string[][]): void;
