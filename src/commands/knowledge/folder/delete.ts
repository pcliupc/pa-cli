import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../../lib/api-client.js";
import { loadConfig } from "../../../lib/config.js";
import { confirmDestructiveAction } from "../../../lib/confirm.js";
import { printKnowledgeError } from "../../../lib/knowledge-errors.js";
import { resolveKnowledgeTarget } from "../../../lib/knowledge-scope.js";
import { outputData, type OutputFormat } from "../../../lib/output.js";

export function registerKnowledgeFolderDeleteCommand(folderCmd: Command): void {
  folderCmd
    .command("delete")
    .description("Delete a knowledge folder")
    .argument("<folder-id>", "Knowledge folder ID")
    .option("--space <id>", "Knowledge Space ID")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (
      folderId: string,
      options: { space?: string; force?: boolean },
    ) => {
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
      const spinner = ora("Deleting knowledge folder...").start();

      try {
        const confirmed = await confirmDestructiveAction(
          `Delete knowledge folder "${folderId}"?`,
          { force: options.force === true },
        );
        if (!confirmed) {
          spinner.stop();
          console.log("Cancelled.");
          return;
        }

        const target = resolveKnowledgeTarget(options.space);
        const params = new URLSearchParams({ scope: target.target });
        if (target.spaceId !== undefined) params.set("spaceId", target.spaceId);
        const response = await client.deleteJson(
          `/api/knowledge/folders/${folderId}?${params.toString()}`,
        );
        spinner.stop();

        outputData(
          outputFormat === "json" ? response : { id: folderId, deleted: true },
          outputFormat,
          ["ID", "Deleted"],
          [[folderId, "yes"]],
        );
      } catch (error) {
        spinner.stop();
        printKnowledgeError(error, outputFormat);
        process.exit(1);
      }
    });
}
