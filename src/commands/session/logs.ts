import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface LogEntry {
  timestamp: string;
  logType: string;
  toolName?: string;
  isError?: boolean;
  content?: string;
  status?: string;
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
        const logs = await client.getJson<LogEntry[]>(
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
          const time = log.timestamp ? log.timestamp.slice(11, 19) : "??:??:??";
          const icon = log.isError ? chalk.red("✗") : log.logType === "tool_call" ? "🔧" : "📋";
          const type = chalk.gray(`[${log.logType}]`);
          const tool = log.toolName ? chalk.cyan(log.toolName) : "";
          const status = log.status ? chalk.gray(`(${log.status})`) : "";
          const content = log.content ? ` ${log.content.slice(0, 80)}` : "";

          console.log(`${time} ${icon}${type} ${tool}${status}${content}`);
        }

        console.log(chalk.gray(`\n${logs.length} log entries`));
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
