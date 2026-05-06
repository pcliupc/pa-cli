import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface McpListItem {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  connectionType: string;
  credentialMode: string;
  isActive: boolean;
  isBuiltin: boolean;
  spaceId: string | null;
  updatedAt: string;
}

interface McpListResponse {
  items: McpListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function registerMcpListCommand(mcpCmd: Command): void {
  mcpCmd
    .command("list")
    .description("List MCP servers")
    .option("--category <category>", "Filter by category (platform, data, ai, utility)")
    .option("--search <keyword>", "Search by keyword")
    .option("--space <id>", "Filter by space ID")
    .action(async (options: { category?: string; search?: string; space?: string }) => {
      const config = loadConfig();
      const parentOpts = mcpCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });

      const spinner = ora("Loading MCP servers...").start();
      try {
        const params = new URLSearchParams();
        if (options.category) params.set("category", options.category);
        if (options.search) params.set("search", options.search);
        if (options.space) params.set("spaceId", options.space);
        const qs = params.toString();

        const resp = await client.getJson<McpListItem[] | McpListResponse>(
          `/api/mcp-servers${qs ? `?${qs}` : ""}`,
        );
        const servers = Array.isArray(resp) ? resp : resp.items;

        spinner.stop();

        if (servers.length === 0) {
          console.log("No MCP servers found.");
          return;
        }

        outputData(
          servers,
          outputFormat,
          ["ID", "Name", "Display Name", "Category", "Type", "Auth", "Active", "Updated"],
          servers.map((s) => [
            s.id.slice(0, 12) + "...",
            s.name,
            (s.displayName || "").slice(0, 20),
            s.category,
            s.connectionType,
            s.credentialMode,
            s.isActive ? "✓" : "✗",
            s.updatedAt.slice(0, 10),
          ]),
        );
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
