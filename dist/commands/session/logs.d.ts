import { Command } from "commander";
interface RawLogEntry {
    timestamp?: number | string | null;
    type?: string;
    logType?: string;
    toolName?: string;
    isError?: boolean;
    content?: string;
    status?: string;
}
interface NormalizedLogEntry {
    timestampText: string;
    type: string;
    toolName?: string;
    isError: boolean;
    content?: string;
    status?: string;
}
export declare function formatLogTimestamp(timestamp: number | string | null | undefined): string;
export declare function normalizeLogEntry(log: RawLogEntry): NormalizedLogEntry;
export declare function renderLogEntryLine(log: RawLogEntry): string;
export declare function registerSessionLogsCommand(sessionCmd: Command): void;
export {};
