import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface LiveArtifactCurrentVersion {
  version: number;
  createdAt: string;
}

interface LiveArtifactListItem {
  id: string;
  title: string;
  artifactType: string;
  packageFormat: string;
  status: string;
  currentVersion: LiveArtifactCurrentVersion | null;
  createdAt: string;
}

interface LiveArtifactListPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PaginatedLiveArtifactListResponse {
  items: LiveArtifactListItem[];
  pagination: LiveArtifactListPagination;
}

async function fetchAllLiveArtifacts(
  client: PaApiClient,
  baseParams: URLSearchParams,
): Promise<LiveArtifactListItem[]> {
  const firstQuery = baseParams.toString();
  const firstPage = await client.getJson<PaginatedLiveArtifactListResponse>(
    `/api/live-artifacts${firstQuery ? `?${firstQuery}` : ""}`,
  );

  const artifacts = [...firstPage.items];
  const {
    pagination: { totalPages, pageSize },
  } = firstPage;

  for (let page = 2; page <= totalPages; page += 1) {
    const nextParams = new URLSearchParams(baseParams);
    nextParams.set("page", String(page));
    nextParams.set("pageSize", String(pageSize));
    const nextPage = await client.getJson<PaginatedLiveArtifactListResponse>(
      `/api/live-artifacts?${nextParams.toString()}`,
    );
    artifacts.push(...nextPage.items);
  }

  return artifacts;
}

export function registerLiveArtifactListCommand(liveArtifactCmd: Command): void {
  liveArtifactCmd
    .command("list")
    .description("List all live artifacts")
    .option("--space <id>", "Filter by space ID")
    .option("--status <val>", "Filter by status (published/archived/all)")
    .option("--scope <val>", "Scope: self or all", "self")
    .option("--search <kw>", "Search by title")
    .action(async (options: { space?: string; status?: string; scope?: string; search?: string }) => {
      const config = loadConfig();
      const parentOpts = liveArtifactCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora("Loading live artifacts...").start();
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "50");
        params.set("scope", options.scope ?? "self");
        if (options.space) params.set("spaceId", options.space);
        if (options.status) params.set("status", options.status);
        if (options.search) params.set("q", options.search);
        const artifacts = await fetchAllLiveArtifacts(client, params);

        spinner.stop();

        if (artifacts.length === 0) {
          console.log("No live artifacts found.");
          return;
        }

        outputData(
          artifacts,
          outputFormat,
          ["ID", "Title", "Type", "Status", "Version", "Created"],
          artifacts.map((a) => [
            a.id,
            a.title,
            a.artifactType,
            a.status,
            a.currentVersion ? String(a.currentVersion.version) : "-",
            a.createdAt.slice(0, 10),
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
