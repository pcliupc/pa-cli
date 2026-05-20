import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../../lib/api-client.js";
import { loadConfig } from "../../../lib/config.js";

interface ExistingSourceDocument {
  id: string;
  sourceType: string;
  sessionId: string;
  path: string;
  [key: string]: unknown;
}

interface LiveArtifactDetail {
  id: string;
  sourceDocuments: ExistingSourceDocument[];
  [key: string]: unknown;
}

interface LiveArtifactGetResponse {
  artifact: LiveArtifactDetail;
}

interface PatchBody {
  sourceDocuments: Array<{
    sourceType: string;
    sessionId: string;
    path: string;
  }>;
}

export function registerSourceDocsRemoveCommand(
  sourceDocsCmd: Command,
): void {
  sourceDocsCmd
    .command("remove")
    .description("Remove a source document from a live artifact")
    .argument("<id>", "Live artifact ID")
    .argument("<docId>", "Source document ID to remove")
    .action(async (artifactId: string, docId: string) => {
      const config = loadConfig();
      const liveArtifactCmd = sourceDocsCmd.parent?.parent;
      const parentOpts = liveArtifactCmd?.opts?.() as
        | { output?: string; server?: string }
        | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;

      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora(
        `Removing source document "${docId}" from "${artifactId}"...`,
      ).start();
      try {
        const result = await client.getJson<LiveArtifactGetResponse>(
          `/api/live-artifacts/${artifactId}`,
        );

        const existingDocs = result.artifact.sourceDocuments ?? [];
        const targetDoc = existingDocs.find((d) => d.id === docId);

        if (!targetDoc) {
          spinner.stop();
          console.error(
            chalk.red(
              `Error: source document "${docId}" not found in live artifact "${artifactId}".`,
            ),
          );
          process.exit(1);
        }

        const filteredDocs = existingDocs.filter((d) => d.id !== docId);

        const patchBody: PatchBody = {
          sourceDocuments: filteredDocs.map((d) => ({
            sourceType: d.sourceType,
            sessionId: d.sessionId,
            path: d.path,
          })),
        };

        await client.patchJson(
          `/api/live-artifacts/${artifactId}`,
          patchBody,
        );
        spinner.stop();

        console.log(
          chalk.green(
            `✓ Source document "${docId}" removed from "${artifactId}"`,
          ),
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
