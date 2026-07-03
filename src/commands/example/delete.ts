import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import readline from "node:readline";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

function confirmPrompt(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });
}

export function registerExampleDeleteCommand(exampleCmd: Command): void {
  exampleCmd
    .command("delete")
    .description("Delete an example from library")
    .argument("<id>", "Example ID")
    .option("-f, --force", "Skip confirmation")
    .action(async (exampleId: string, options: { force?: boolean }) => {
      const config = loadConfig();
      const parentOpts = exampleCmd.parent?.opts?.() as { server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      if (!options.force) {
        const confirmed = await confirmPrompt(`Delete example "${exampleId}"?`);
        if (!confirmed) {
          console.log("Cancelled.");
          return;
        }
      }

      const spinner = ora(`Deleting example "${exampleId}"...`).start();
      try {
        await client.delete(`/api/examples/${encodeURIComponent(exampleId)}`);
        spinner.stop();
        console.log(chalk.green(`✓ Example "${exampleId}" deleted`));
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
    });
}

