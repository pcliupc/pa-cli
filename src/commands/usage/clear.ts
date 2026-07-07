import { createInterface } from "node:readline";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";

import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface UsageClearResponse {
  clearedAt: string;
  clearedDailyStatCount: number;
  resetUsageCursorCount: number;
}

function confirmPrompt(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });
}

export function registerUsageClearCommand(usageCmd: Command): void {
  usageCmd
    .command("clear")
    .description("Clear platform usage analytics and reset usage cursor day baselines")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (options: { force?: boolean }) => {
      const config = loadConfig();
      const parentOpts = usageCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      if (!options.force) {
        const confirmed = await confirmPrompt(
          "Clear all platform usage analytics data and reset billing baseline?",
        );
        if (!confirmed) {
          console.log("Cancelled.");
          return;
        }
      }

      const spinner = ora("Clearing usage analytics...").start();
      try {
        const result = await client.postJson<UsageClearResponse>(
          "/api/admin/usage-analytics/clear",
        );
        spinner.stop();

        outputData(
          result,
          outputFormat,
          ["Cleared At", "Daily Rows Cleared", "Cursor Baselines Reset"],
          [
            [
              result.clearedAt,
              String(result.clearedDailyStatCount),
              String(result.resetUsageCursorCount),
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
