import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface CreateResult {
  id: string;
  name: string;
  displayName: string;
}

export function registerMcpCreateCommand(mcpCmd: Command): void {
  mcpCmd
    .command("create")
    .description("Create an MCP server from a JSON config file")
    .argument("<path>", "Path to JSON config file")
    .option("--space <id>", "Target space ID (defaults to default space)")
    .action(async (inputPath: string, options: { space?: string }) => {
      const config = loadConfig();
      const parentOpts = mcpCmd.parent?.opts?.() as { server?: string } | undefined;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });

      const resolvedPath = path.resolve(inputPath);
      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`Error: File not found: ${resolvedPath}`));
        process.exit(1);
      }

      let body: Record<string, unknown>;
      try {
        const raw = fs.readFileSync(resolvedPath, "utf-8");
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        console.error(chalk.red("Error: Invalid JSON file."));
        process.exit(1);
      }

      if (options.space) {
        body.spaceId = options.space;
      }

      const spinner = ora("Creating MCP server...").start();
      try {
        const result = await client.postJson<CreateResult>("/api/mcp-servers", body);
        spinner.stop();
        console.log(
          chalk.green(`✓ MCP server "${result.displayName || result.name}" created (${result.id})`),
        );
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
    });
}
