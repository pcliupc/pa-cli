import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { createInterface } from "node:readline";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

async function confirmPrompt(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export function registerMcpDeleteCommand(mcpCmd: Command): void {
  mcpCmd
    .command("delete")
    .description("Delete an MCP server")
    .argument("<id>", "MCP server ID")
    .option("-f", "Skip confirmation prompt")
    .action(async (serverId: string, options: { f?: boolean }) => {
      const config = loadConfig();
      const parentOpts = mcpCmd.parent?.opts?.() as { server?: string } | undefined;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });

      if (!options.f) {
        const confirmed = await confirmPrompt(`Delete MCP server "${serverId}"?`);
        if (!confirmed) {
          console.log("Cancelled.");
          return;
        }
      }

      const spinner = ora("Deleting MCP server...").start();
      try {
        await client.delete(`/api/mcp-servers/${serverId}`);
        spinner.stop();
        console.log(chalk.green(`✓ MCP server "${serverId}" deleted`));
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
    });
}
