import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { addKnowledgeScopeQuery } from "../../lib/knowledge-scope.js";
import type { KnowledgeListResponse } from "../../lib/knowledge-types.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

function displayType(type: string): string {
  return type === "doc" ? "md" : type;
}

export function registerKnowledgeListCommand(knowledgeCmd: Command): void {
  knowledgeCmd
    .command("list")
    .description("List knowledge documents")
    .option("--space <id>", "Knowledge Space ID")
    .option("--folder <id>", "Filter by folder ID")
    .option("--search <query>", "Search by title or content")
    .option("--limit <n>", "Number of documents to return", "50")
    .option("--offset <n>", "Number of documents to skip", "0")
    .action(async (options: {
      space?: string;
      folder?: string;
      search?: string;
      limit: string;
      offset: string;
    }) => {
      const config = loadConfig();
      const parentOpts = knowledgeCmd.parent?.opts?.() as {
        output?: string;
        server?: string;
      } | undefined;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const spinner = ora("Loading knowledge...").start();

      try {
        const params = new URLSearchParams();
        addKnowledgeScopeQuery(params, options.space);
        if (options.folder) params.set("folderId", options.folder);
        if (options.search) params.set("q", options.search);
        params.set("limit", options.limit);
        params.set("offset", options.offset);

        const response = await client.getJson<KnowledgeListResponse>(
          `/api/knowledge?${params.toString()}`,
        );
        spinner.stop();

        outputData(
          outputFormat === "json" ? response : response.items,
          outputFormat,
          ["ID", "Title", "Type", "Folder", "Revision", "Updated"],
          response.items.map((document) => [
            document.id,
            document.title,
            displayType(document.type),
            document.folderId ?? "-",
            String(document.revisionNumber ?? "-"),
            document.updatedAt.slice(0, 10),
          ]),
        );
      } catch (error) {
        spinner.stop();
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
