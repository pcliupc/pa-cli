import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { type OutputFormat } from "../../lib/output.js";

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

export function formatLogTimestamp(timestamp: number | string | null | undefined): string {
  if (typeof timestamp === "number") {
    if (!Number.isFinite(timestamp)) return "??:??:??";
    return new Date(timestamp).toISOString().slice(11, 19);
  }

  if (typeof timestamp === "string") {
    if (timestamp.length >= 19 && timestamp[10] === "T") {
      return timestamp.slice(11, 19);
    }

    const parsed = Date.parse(timestamp);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString().slice(11, 19);
    }
  }

  return "??:??:??";
}

export function normalizeLogEntry(log: RawLogEntry): NormalizedLogEntry {
  const type = log.type ?? log.logType ?? "unknown";
  const isError = Boolean(log.isError || log.status === "error");

  return {
    timestampText: formatLogTimestamp(log.timestamp),
    type,
    toolName: log.toolName,
    isError,
    content: log.content,
    status: log.status,
  };
}

export function renderLogEntryLine(log: RawLogEntry): string {
  const normalized = normalizeLogEntry(log);
  const icon = normalized.isError
    ? chalk.red("✗")
    : normalized.type === "tool_call"
      ? "🔧"
      : "📋";
  const type = chalk.gray(`[${normalized.type}]`);
  const tool = normalized.toolName ? chalk.cyan(normalized.toolName) : "";
  const status = normalized.status ? chalk.gray(`(${normalized.status})`) : "";
  const content = normalized.content ? ` ${normalized.content.slice(0, 80)}` : "";

  return `${normalized.timestampText} ${icon}${type} ${tool}${status}${content}`;
}

export function registerSessionLogsCommand(sessionCmd: Command): void {
  sessionCmd
    .command("logs")
    .description("Get session execution logs")
    .argument("<id>", "Session ID")
    .option("--limit <n>", "Max log entries (default: 50)", "50")
    .action(async (sessionId: string, options: { limit?: string }) => {
      const config = loadConfig();
      const parentOpts = sessionCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });

      const spinner = ora("Loading logs...").start();
      try {
        const limit = options.limit ?? "50";
        const logs = await client.getJson<RawLogEntry[]>(
          `/api/sessions/${sessionId}/logs?limit=${limit}`,
        );
        spinner.stop();

        if (!logs || logs.length === 0) {
          console.log("No logs found.");
          return;
        }

        if (outputFormat === "json") {
          console.log(JSON.stringify(logs, null, 2));
          return;
        }

        for (const log of logs) {
          console.log(renderLogEntryLine(log));
        }

        console.log(chalk.gray(`\n${logs.length} log entries`));
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
