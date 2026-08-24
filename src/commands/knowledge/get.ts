import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import ora from "ora";
import { ApiError, PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { printKnowledgeError } from "../../lib/knowledge-errors.js";
import type { KnowledgeDocumentResponse } from "../../lib/knowledge-types.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

function displayType(type: string): string {
  return type === "doc" ? "md" : type;
}

export function registerKnowledgeGetCommand(knowledgeCmd: Command): void {
  knowledgeCmd
    .command("get")
    .description("Get a knowledge document")
    .argument("<id>", "Knowledge document ID")
    .option("--content", "Output document content")
    .option("-o, --output-file <path>", "Write content to a file")
    .action(async (
      documentId: string,
      options: { content?: boolean; outputFile?: string },
    ) => {
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
      const spinner = ora("Loading knowledge document...").start();

      try {
        const response = await client.getJson<KnowledgeDocumentResponse>(
          `/api/knowledge/${documentId}`,
        );
        spinner.stop();

        if (options.content) {
          if (response.document.type === "page") {
            throw new ApiError("", 422, "knowledge.pageContentReadOnly");
          }
          if (response.document.type === "file") {
            throw new ApiError("", 422, "knowledge.fileContentReadOnly");
          }

          if (options.outputFile) {
            fs.mkdirSync(path.dirname(options.outputFile), { recursive: true });
            fs.writeFileSync(options.outputFile, response.document.content, "utf8");
          } else {
            process.stdout.write(response.document.content);
          }
          return;
        }

        outputData(
          outputFormat === "json" ? response : response.document,
          outputFormat,
          ["Field", "Value"],
          [
            ["ID", response.document.id],
            ["Title", response.document.title],
            ["Type", displayType(response.document.type)],
            ["Status", response.document.status],
            ["Space", response.document.spaceId ?? "-"],
            ["Folder", response.document.folderId ?? "-"],
            ["Revision", String(response.document.revisionNumber ?? "-")],
            ["Updated", response.document.updatedAt],
          ],
        );
      } catch (error) {
        spinner.stop();
        printKnowledgeError(error, outputFormat);
        process.exit(1);
      }
    });
}
