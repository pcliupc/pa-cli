import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../../lib/api-client.js";
import { loadConfig } from "../../../lib/config.js";
import { printKnowledgeError } from "../../../lib/knowledge-errors.js";
import { resolveKnowledgeTarget } from "../../../lib/knowledge-scope.js";
import type { KnowledgeFolderResponse } from "../../../lib/knowledge-types.js";
import { outputData, type OutputFormat } from "../../../lib/output.js";

export function registerKnowledgeFolderCreateCommand(folderCmd: Command): void {
  folderCmd
    .command("create")
    .description("Create a knowledge folder")
    .argument("<name>", "Folder name")
    .option("--space <id>", "Target Space ID")
    .option("--parent <id>", "Parent folder ID")
    .action(async (name: string, options: { space?: string; parent?: string }) => {
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
      const spinner = ora("Creating knowledge folder...").start();

      try {
        const response = await client.postJson<KnowledgeFolderResponse>(
          "/api/knowledge/folders",
          {
            ...resolveKnowledgeTarget(options.space),
            name,
            parentId: options.parent ?? null,
          },
        );
        spinner.stop();

        outputData(
          outputFormat === "json" ? response : response.folder,
          outputFormat,
          ["ID", "Name", "Parent", "Space", "Created", "Updated"],
          [[
            response.folder.id,
            response.folder.name,
            response.folder.parentId ?? "-",
            response.folder.spaceId ?? "-",
            response.folder.createdAt?.slice(0, 10) ?? "-",
            response.folder.updatedAt?.slice(0, 10) ?? "-",
          ]],
        );
      } catch (error) {
        spinner.stop();
        printKnowledgeError(error, outputFormat);
        process.exit(1);
      }
    });
}
