import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";

import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface UsageOverviewResponse {
  inputTokens: string;
  outputTokens: string;
  totalTokens: string;
  modelDurationMs: string;
  searchCallCount: string;
  activeUserCount: string;
  activeAgentCount: string;
  activeSessionCount: string;
}

function buildOverviewPath(options: {
  dateFrom?: string;
  dateTo?: string;
}): string {
  const params = new URLSearchParams();
  if (options.dateFrom?.trim()) {
    params.set("dateFrom", options.dateFrom.trim());
  }
  if (options.dateTo?.trim()) {
    params.set("dateTo", options.dateTo.trim());
  }
  const query = params.toString();
  return query ? `/api/usage-analytics/overview?${query}` : "/api/usage-analytics/overview";
}

export function registerUsageGetCommand(usageCmd: Command): void {
  usageCmd
    .command("get")
    .description("Get platform usage overview")
    .option("--date-from <YYYY-MM-DD>", "Start date filter (inclusive)")
    .option("--date-to <YYYY-MM-DD>", "End date filter (inclusive)")
    .action(async (options: { dateFrom?: string; dateTo?: string }) => {
      const config = loadConfig();
      const parentOpts = usageCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora("Loading usage overview...").start();
      try {
        const result = await client.getJson<UsageOverviewResponse>(
          buildOverviewPath(options),
        );
        spinner.stop();

        outputData(
          result,
          outputFormat,
          [
            "Input Tokens",
            "Output Tokens",
            "Total Tokens",
            "Model Duration (ms)",
            "Search Calls",
            "Active Users",
            "Active Agents",
            "Active Sessions",
          ],
          [
            [
              result.inputTokens,
              result.outputTokens,
              result.totalTokens,
              result.modelDurationMs,
              result.searchCallCount,
              result.activeUserCount,
              result.activeAgentCount,
              result.activeSessionCount,
            ],
          ],
        );
      } catch (err) {
        spinner.stop();
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
