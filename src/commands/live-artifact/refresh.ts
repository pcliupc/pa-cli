import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface RefreshResponse {
  refresh: {
    version: number;
    reason: string;
  };
}

export function registerLiveArtifactRefreshCommand(
  liveArtifactCmd: Command,
): void {
  liveArtifactCmd
    .command("refresh")
    .description("Refresh a live artifact to rebuild the bundle")
    .argument("<id>", "Live artifact ID")
    .action(async (id: string) => {
      const config = loadConfig();
      const client = new PaApiClient({
        serverUrl: config.serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora(`Refreshing live artifact "${id}"...`).start();
      try {
        const result = await client.postJson<RefreshResponse>(
          `/api/live-artifacts/${id}/refresh`,
          {},
        );
        spinner.stop();
        console.log(
          chalk.green(
            `✓ Live artifact "${id}" refreshed to version ${result.refresh.version}`,
          ),
        );
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }
    });
}
