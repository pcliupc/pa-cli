import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface ExampleListItem {
  id: string;
  title: string;
  summary: string | null;
  sourceSessionId: string | null;
  sourcePlatform: string | null;
  updatedAt: string;
  assetCounts?: {
    files?: number;
    artifacts?: number;
    "live-artifacts"?: number;
  };
}

interface ExampleListResponse {
  items: ExampleListItem[];
  total: number;
  page: number;
  pageSize: number;
}

async function fetchAllExamples(
  client: PaApiClient,
  baseParams: URLSearchParams,
): Promise<ExampleListItem[]> {
  const firstQuery = baseParams.toString();
  const firstPage = await client.getJson<ExampleListResponse>(
    `/api/examples${firstQuery ? `?${firstQuery}` : ""}`,
  );

  const items = [...(firstPage.items ?? [])];
  const total = Number(firstPage.total ?? items.length);
  const firstPageSize = Math.max(1, Number(firstPage.pageSize ?? 50));
  const totalPages = Math.max(1, Math.ceil(total / firstPageSize));

  for (let page = 2; page <= totalPages; page += 1) {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(page));
    params.set("pageSize", String(firstPageSize));
    const nextPage = await client.getJson<ExampleListResponse>(
      `/api/examples?${params.toString()}`,
    );
    items.push(...(nextPage.items ?? []));
  }

  return items;
}

export function registerExampleListCommand(exampleCmd: Command): void {
  exampleCmd
    .command("list")
    .description("List examples in a space")
    .option("--space <spaceKey>", "Target space key (default: current/default space)")
    .option("--search <kw>", "Filter by title/summary/session")
    .action(async (options: { space?: string; search?: string }) => {
      const config = loadConfig();
      const parentOpts = exampleCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora("Loading examples...").start();
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "50");
        if (options.space) {
          params.set("spaceKey", options.space);
        }
        if (options.search) {
          params.set("q", options.search);
        }

        const items = await fetchAllExamples(client, params);
        spinner.stop();

        if (items.length === 0) {
          console.log("No examples found.");
          return;
        }

        outputData(
          items,
          outputFormat,
          ["ID", "Title", "Session", "Files", "Artifacts", "Live", "Updated"],
          items.map((item) => [
            item.id,
            item.title,
            item.sourceSessionId ?? "-",
            String(item.assetCounts?.files ?? 0),
            String(item.assetCounts?.artifacts ?? 0),
            String(item.assetCounts?.["live-artifacts"] ?? 0),
            item.updatedAt.slice(0, 19).replace("T", " "),
          ]),
        );
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}

