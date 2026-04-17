import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface SessionListItem {
  session_id: string;
  agent_id: string;
  title: string;
  status: string;
  updated_at: string;
}

interface SessionListResponse {
  items: SessionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function registerSessionListCommand(sessionCmd: Command): void {
  sessionCmd
    .command("list")
    .description("List sessions")
    .option("--agent <id>", "Filter by agent ID")
    .option("--scope <scope>", "Scope: self or all (default: self)", "self")
    .option("--page <n>", "Page number (default: 1)", "1")
    .option("--limit <n>", "Page size (default: 20)", "20")
    .action(async (options: { agent?: string; scope?: string; page?: string; limit?: string }) => {
      const config = loadConfig();
      const parentOpts = sessionCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });

      const spinner = ora("Loading sessions...").start();
      try {
        const params = new URLSearchParams();
        if (options.agent) params.set("agentId", options.agent);
        if (options.scope) params.set("scope", options.scope);
        if (options.page) params.set("page", options.page);
        if (options.limit) params.set("pageSize", options.limit);
        const qs = params.toString();

        const resp = await client.getJson<SessionListResponse>(
          `/api/sessions${qs ? `?${qs}` : ""}`,
        );

        const sessions = resp.items;
        spinner.stop();

        if (sessions.length === 0) {
          console.log("No sessions found.");
          return;
        }

        outputData(
          sessions,
          outputFormat,
          ["ID", "Agent", "Title", "Status", "Updated"],
          sessions.map((s) => [
            s.session_id.slice(0, 12) + "...",
            s.agent_id,
            (s.title || "").slice(0, 30),
            s.status,
            s.updated_at.slice(0, 10),
          ]),
        );

        const totalPages = Math.ceil(resp.total / resp.pageSize);
        if (outputFormat !== "json" && totalPages > 1) {
          console.log(`\nShowing ${(resp.page - 1) * resp.pageSize + 1}-${Math.min(resp.page * resp.pageSize, resp.total)} of ${resp.total} (page ${resp.page}/${totalPages})`);
        }
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
