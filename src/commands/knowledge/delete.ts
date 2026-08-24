import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { confirmDestructiveAction } from "../../lib/confirm.js";
import { printKnowledgeError } from "../../lib/knowledge-errors.js";
import type { KnowledgeDocumentResponse } from "../../lib/knowledge-types.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

export function registerKnowledgeDeleteCommand(knowledgeCmd: Command): void {
  knowledgeCmd
    .command("delete")
    .description("Delete a knowledge document")
    .argument("<document-id>", "Knowledge document ID")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (documentId: string, options: { force?: boolean }) => {
      const config = loadConfig();
      const parentOpts = knowledgeCmd.parent?.opts?.() as {
        output?: string;
        server?: string;
      } | undefined;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });
      const spinner = ora("Deleting knowledge...").start();

      try {
        const confirmed = await confirmDestructiveAction(
          `Delete knowledge document "${documentId}"?`,
          { force: options.force === true },
        );
        if (!confirmed) {
          spinner.stop();
          console.log("Cancelled.");
          return;
        }

        const current = await client.getJson<KnowledgeDocumentResponse>(
          `/api/knowledge/${documentId}`,
        );
        const expectedCurrentRevisionId = current.document.currentRevisionId;
        if (!expectedCurrentRevisionId) {
          throw new Error("Knowledge document current revision is required before deletion.");
        }

        const response = await client.deleteJson(
          `/api/knowledge/${documentId}`,
          { expectedCurrentRevisionId },
        );
        spinner.stop();

        outputData(
          outputFormat === "json" ? response : { id: documentId, deleted: true },
          outputFormat,
          ["ID", "Deleted"],
          [[documentId, "yes"]],
        );
      } catch (error) {
        spinner.stop();
        printKnowledgeError(error, outputFormat);
        process.exit(1);
      }
    });
}
