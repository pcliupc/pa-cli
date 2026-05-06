import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import readline from "node:readline";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface DeleteAgentResponse {
  status?: "deleted" | "disabled";
  reason?: string;
  sessionCount?: number;
  liveArtifactCount?: number;
  message?: string;
}

export function registerAgentDeleteCommand(agentCmd: Command): void {
  agentCmd
    .command("delete")
    .description("Delete an agent")
    .argument("<id>", "Agent ID")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (agentId: string, options: { force?: boolean }) => {
      const config = loadConfig();
      const client = new PaApiClient({
        serverUrl: config.serverUrl,
        apiKey: config.apiKey,
      });

      if (!options.force) {
        const confirmed = await confirm(`Delete agent "${agentId}"?`);
        if (!confirmed) {
          console.log("Cancelled.");
          return;
        }
      }

      const spinner = ora(`Deleting agent "${agentId}"...`).start();
      try {
        const result = await client.deleteJson<DeleteAgentResponse>(`/api/agents/${agentId}`);
        spinner.stop();
        if (result.status === "disabled") {
          const details = [
            typeof result.sessionCount === "number" ? `${result.sessionCount} sessions` : null,
            typeof result.liveArtifactCount === "number"
              ? `${result.liveArtifactCount} live artifacts kept`
              : null,
          ].filter(Boolean);
          const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
          console.log(
            chalk.yellow(`! Agent "${agentId}" disabled because sessions exist${suffix}`),
          );
        } else {
          console.log(chalk.green(`✓ Agent "${agentId}" deleted`));
        }
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
