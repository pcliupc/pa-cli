import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../../lib/api-client.js";
import { loadConfig } from "../../../lib/config.js";
import { outputData, type OutputFormat } from "../../../lib/output.js";

interface LiveArtifactSourceDocument {
  id: string;
  label: string;
  sourceType: string;
  path: string;
  mimeType: string;
  openMode: string;
  [key: string]: unknown;
}

interface LiveArtifactDetail {
  id: string;
  sourceDocuments: LiveArtifactSourceDocument[];
  [key: string]: unknown;
}

interface LiveArtifactGetResponse {
  artifact: LiveArtifactDetail;
}

export function registerSourceDocsListCommand(
  sourceDocsCmd: Command,
): void {
  sourceDocsCmd
    .command("list")
    .description("List source documents of a live artifact")
    .argument("<id>", "Live artifact ID")
    .action(async (artifactId: string) => {
      const config = loadConfig();
      const liveArtifactCmd = sourceDocsCmd.parent?.parent;
      const parentOpts = liveArtifactCmd?.opts?.() as
        | { output?: string; server?: string }
        | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora(
        `Fetching source documents for "${artifactId}"...`,
      ).start();
      try {
        const result = await client.getJson<LiveArtifactGetResponse>(
          `/api/live-artifacts/${artifactId}`,
        );
        spinner.stop();

        const docs = result.artifact.sourceDocuments ?? [];

        if (docs.length === 0) {
          console.log("No source documents found.");
          return;
        }

        outputData(
          docs,
          outputFormat,
          ["ID", "Label", "Type", "Path", "Mode"],
          docs.map((d) => [
            d.id,
            d.label,
            d.sourceType,
            d.path,
            d.openMode,
          ]),
        );
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }
    });
}
