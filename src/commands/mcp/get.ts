import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface McpServerDetail {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  connectionType: string;
  transport: string;
  credentialMode: string;
  url: string | null;
  command: string | null;
  isActive: boolean;
  isBuiltin: boolean;
  spaceId: string | null;
  tools: unknown[];
  resources: unknown[];
  createdAt: string;
  updatedAt: string;
}

export function registerMcpGetCommand(mcpCmd: Command): void {
  mcpCmd
    .command("get")
    .description("Get MCP server details")
    .argument("<id>", "MCP server ID")
    .action(async (serverId: string) => {
      const config = loadConfig();
      const parentOpts = mcpCmd.parent?.opts?.() as { server?: string } | undefined;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora("Loading MCP server...").start();
      try {
        const server = await client.getJson<McpServerDetail>(`/api/mcp-servers/${serverId}`);
        spinner.stop();

        console.log(`Name: ${server.displayName} (${server.name})`);
        console.log(`ID: ${server.id}`);
        console.log(`Category: ${server.category}`);
        console.log(`Connection: ${server.connectionType} (${server.transport})`);
        console.log(`Auth: ${server.credentialMode}`);
        if (server.url) console.log(`URL: ${server.url}`);
        if (server.command) console.log(`Command: ${server.command}`);
        console.log(`Active: ${server.isActive ? "yes" : "no"}`);
        console.log(`Built-in: ${server.isBuiltin ? "yes" : "no"}`);
        if (server.spaceId) console.log(`Space: ${server.spaceId}`);
        if (server.description) console.log(`Description: ${server.description}`);
        const toolCount = Array.isArray(server.tools) ? server.tools.length : 0;
        const resourceCount = Array.isArray(server.resources) ? server.resources.length : 0;
        console.log(`Tools: ${toolCount}, Resources: ${resourceCount}`);
        console.log(`Created: ${server.createdAt.slice(0, 10)}`);
        console.log(`Updated: ${server.updatedAt.slice(0, 10)}`);
      } catch (err) {
        spinner.stop();
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
