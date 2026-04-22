import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface AgentListItem {
  agent_id: string;
  name: string;
  description: string;
  isActive: boolean;
  stage_count: number;
  updatedAt: string;
}

interface AgentListPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PaginatedAgentListResponse {
  items: AgentListItem[];
  pagination: AgentListPagination;
}

function isPaginatedResponse(
  payload: AgentListItem[] | PaginatedAgentListResponse,
): payload is PaginatedAgentListResponse {
  return !Array.isArray(payload);
}

async function fetchAllAgents(
  client: PaApiClient,
  baseParams: URLSearchParams,
): Promise<AgentListItem[]> {
  const firstQuery = baseParams.toString();
  const firstPage = await client.getJson<AgentListItem[] | PaginatedAgentListResponse>(
    `/api/agents${firstQuery ? `?${firstQuery}` : ""}`,
  );

  if (!isPaginatedResponse(firstPage)) {
    return firstPage;
  }

  const agents = [...firstPage.items];
  const {
    pagination: { totalPages, pageSize },
  } = firstPage;

  for (let page = 2; page <= totalPages; page += 1) {
    const nextParams = new URLSearchParams(baseParams);
    nextParams.set("page", String(page));
    nextParams.set("pageSize", String(pageSize));
    const nextPage = await client.getJson<PaginatedAgentListResponse>(
      `/api/agents?${nextParams.toString()}`,
    );
    agents.push(...nextPage.items);
  }

  return agents;
}

export function registerAgentListCommand(agentCmd: Command): void {
  agentCmd
    .command("list")
    .description("List all agents")
    .option("--all", "Include inactive agents")
    .option("--category <id>", "Filter by category")
    .action(async (options: { all?: boolean; category?: string }) => {
      const config = loadConfig();
      const parentOpts = agentCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora("Loading agents...").start();
      try {
        const params = new URLSearchParams();
        if (options.all) params.set("all", "true");
        if (options.category) params.set("category", options.category);
        const agents = await fetchAllAgents(client, params);

        spinner.stop();

        if (agents.length === 0) {
          console.log("No agents found.");
          return;
        }

        outputData(
          agents,
          outputFormat,
          ["ID", "Name", "Description", "Active", "Stages", "Updated"],
          agents.map((a) => [
            a.agent_id,
            a.name,
            (a.description || "").slice(0, 30),
            a.isActive ? "✓" : "✗",
            String(a.stage_count),
            a.updatedAt.slice(0, 10),
          ]),
        );
      } catch (err) {
        spinner.stop();
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });
}
