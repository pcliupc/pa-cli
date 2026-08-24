import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../../lib/api-client.js";
import { loadConfig } from "../../../lib/config.js";
import { printKnowledgeError } from "../../../lib/knowledge-errors.js";
import { addKnowledgeScopeQuery } from "../../../lib/knowledge-scope.js";
import type { KnowledgeFolderListResponse } from "../../../lib/knowledge-types.js";
import { outputData, type OutputFormat } from "../../../lib/output.js";

export function registerKnowledgeFolderListCommand(folderCmd: Command): void {
  folderCmd
    .command("list")
    .description("List knowledge folders")
    .option("--space <id>", "Knowledge Space ID")
    .option("--parent <id>", "Parent folder ID")
    .action(async (options: { space?: string; parent?: string }) => {
      const config = loadConfig();
      const parentOpts = folderCmd.parent?.parent?.opts?.() as {
        output?: string;
        server?: string;
      } | undefined;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });
      const spinner = ora("Loading knowledge folders...").start();

      try {
        const params = new URLSearchParams();
        addKnowledgeScopeQuery(params, options.space);
        if (options.parent !== undefined) params.set("parentId", options.parent);
        const response = await client.getJson<KnowledgeFolderListResponse>(
          `/api/knowledge/folders?${params.toString()}`,
        );
        spinner.stop();

        outputData(
          outputFormat === "json" ? response : response.folders,
          outputFormat,
          ["ID", "Name", "Parent", "Space", "Created", "Updated"],
          response.folders.map((folder) => [
            folder.id,
            folder.name,
            folder.parentId ?? "-",
            folder.spaceId ?? "-",
            folder.createdAt.slice(0, 10),
            folder.updatedAt.slice(0, 10),
          ]),
        );
      } catch (error) {
        spinner.stop();
        printKnowledgeError(error, outputFormat);
        process.exit(1);
      }
    });
}
