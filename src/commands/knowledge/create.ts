import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { printKnowledgeError } from "../../lib/knowledge-errors.js";
import { readKnowledgeInput } from "../../lib/knowledge-input.js";
import { resolveKnowledgeTarget } from "../../lib/knowledge-scope.js";
import type { KnowledgeCreateResponse } from "../../lib/knowledge-types.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

function displayType(type: string): string {
  return type === "doc" ? "md" : type;
}

export function registerKnowledgeCreateCommand(knowledgeCmd: Command): void {
  knowledgeCmd
    .command("create")
    .description("Create a knowledge document")
    .argument("<path>", "Markdown or CSV path, or - for stdin")
    .option("--type <type>", "Input type: md or csv")
    .option("--title <title>", "Document title")
    .option("--summary <summary>", "Document summary")
    .option("--folder <id>", "Target folder ID")
    .option("--space <id>", "Target Space ID")
    .action(async (
      inputPath: string,
      options: {
        type?: string;
        title?: string;
        summary?: string;
        folder?: string;
        space?: string;
      },
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
      const spinner = ora("Creating knowledge...").start();

      try {
        if (options.type !== undefined
          && options.type !== "md"
          && options.type !== "csv") {
          throw new Error("--type must be md or csv.");
        }

        const input = await readKnowledgeInput(inputPath, {
          type: options.type,
          title: options.title,
        });
        const response = await client.postJson<KnowledgeCreateResponse>(
          "/api/knowledge",
          {
            ...resolveKnowledgeTarget(options.space),
            folderId: options.folder ?? null,
            title: input.title,
            summary: options.summary ?? null,
            source: {
              kind: "text",
              type: input.apiType,
              content: input.content,
            },
          },
        );
        spinner.stop();

        outputData(
          outputFormat === "json" ? response : response.document,
          outputFormat,
          ["ID", "Title", "Type", "Revision"],
          [[
            response.document.id,
            response.document.title,
            displayType(response.document.type),
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
