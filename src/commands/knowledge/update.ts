import { Command } from "commander";
import ora from "ora";
import { ApiError, PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { printKnowledgeError } from "../../lib/knowledge-errors.js";
import { readKnowledgeContent } from "../../lib/knowledge-input.js";
import type { KnowledgeDocumentResponse } from "../../lib/knowledge-types.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

type UpdateOptions = {
  title?: string;
  summary?: string;
  folder?: string;
  rootFolder?: boolean;
};

function displayType(type: string): string {
  return type === "doc" ? "md" : type;
}

export function registerKnowledgeUpdateCommand(knowledgeCmd: Command): void {
  knowledgeCmd
    .command("update")
    .description("Update a knowledge document")
    .argument("<document-id>", "Knowledge document ID")
    .argument("[path]", "New Markdown or CSV path")
    .option("--title <title>", "New document title")
    .option("--summary <summary>", "New document summary")
    .option("--folder <id>", "New folder ID")
    .option("--root-folder", "Move document to the root folder")
    .action(async (documentId: string, inputPath: string | undefined, options: UpdateOptions) => {
      const metadataProvided = options.title !== undefined
        || options.summary !== undefined
        || options.folder !== undefined
        || options.rootFolder === true;
      if (inputPath && metadataProvided) {
        throw new Error("cannot combine content and metadata options");
      }
      if (!inputPath && !metadataProvided) {
        throw new Error("provide a content path or at least one metadata option");
      }

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
      const spinner = ora("Updating knowledge...").start();

      try {
        let response: KnowledgeDocumentResponse | { document: KnowledgeDocumentResponse["document"] };
        if (inputPath) {
          const current = await client.getJson<KnowledgeDocumentResponse>(
            `/api/knowledge/${documentId}`,
          );
          if (current.document.type !== "doc" && current.document.type !== "csv") {
            throw new ApiError("Knowledge document content is not editable as text.", 422,
              current.document.type === "page"
                ? "knowledge.pageContentReadOnly"
                : "knowledge.fileContentReadOnly");
          }
          const content = await readKnowledgeContent(inputPath);
          response = await client.patchJson(`/api/knowledge/${documentId}`, {
            content,
            expectedCurrentRevisionId: current.document.currentRevisionId,
          });
        } else {
          const body: Record<string, unknown> = {};
          if (options.title !== undefined) body.title = options.title;
          if (options.summary !== undefined) body.summary = options.summary;
          if (options.rootFolder) body.folderId = null;
          else if (options.folder !== undefined) body.folderId = options.folder;
          response = await client.patchJson(`/api/knowledge/${documentId}`, body);
        }
        spinner.stop();

        outputData(
          outputFormat === "json" ? response : response.document,
          outputFormat,
          ["ID", "Title", "Type", "Folder", "Revision"],
          [[
            response.document.id,
            response.document.title,
            displayType(response.document.type),
            response.document.folderId ?? "-",
            String(response.document.revisionNumber ?? "-"),
          ]],
        );
      } catch (error) {
        spinner.stop();
        printKnowledgeError(error, outputFormat);
        process.exit(1);
      }
    });
}
