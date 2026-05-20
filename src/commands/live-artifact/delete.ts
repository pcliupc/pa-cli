import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import readline from "node:readline";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface DeleteLiveArtifactResponse {
  ok?: boolean;
}

export function registerLiveArtifactDeleteCommand(
  liveArtifactCmd: Command,
): void {
  liveArtifactCmd
    .command("delete")
    .description("Delete a live artifact")
    .argument("<id>", "Live artifact ID")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (id: string, options: { force?: boolean }) => {
      const config = loadConfig();
      const client = new PaApiClient({
        serverUrl: config.serverUrl,
        apiKey: config.apiKey,
      });

      if (!options.force) {
        const confirmed = await confirm(
          `Delete live artifact "${id}"?`,
        );
        if (!confirmed) {
          console.log("Cancelled.");
          return;
        }
      }

      const spinner = ora(`Deleting live artifact "${id}"...`).start();
      try {
        await client.deleteJson<DeleteLiveArtifactResponse>(
          `/api/live-artifacts/${id}`,
        );
        spinner.stop();
        console.log(chalk.green(`✓ Live artifact "${id}" deleted`));
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

function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
