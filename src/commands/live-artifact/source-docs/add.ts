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
  sourceSessionId: string | null;
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

export function registerSourceDocsAddCommand(
  sourceDocsCmd: Command,
): void {
  sourceDocsCmd
    .command("add")
    .description("Add a source document to a live artifact")
    .argument("<id>", "Live artifact ID")
    .requiredOption("--path <path>", "Workspace file path to add")
    .action(
      async (artifactId: string, options: { path: string }) => {
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
          `Adding source document to "${artifactId}"...`,
        ).start();
        try {
          const result = await client.getJson<LiveArtifactGetResponse>(
            `/api/live-artifacts/${artifactId}`,
          );
          const artifact = result.artifact;

          if (!artifact.sourceSessionId) {
            spinner.stop();
            console.error(
              chalk.red(
                `Error: live artifact "${artifactId}" has no source session ID.`,
              ),
            );
            process.exit(1);
          }

          const existingDocs = artifact.sourceDocuments ?? [];
          const alreadyExists = existingDocs.some(
            (d) => d.path === options.path,
          );
          if (alreadyExists) {
            spinner.stop();
            console.log(
              chalk.yellow(
                `Warning: source document with path "${options.path}" already exists.`,
              ),
            );
            return;
          }

          const patchBody: PatchBody = {
            sourceDocuments: [
              ...existingDocs.map((d) => ({
                sourceType: d.sourceType,
                sessionId: d.sessionId,
                path: d.path,
              })),
              {
                sourceType: "workspace-file",
                sessionId: artifact.sourceSessionId,
                path: options.path,
              },
            ],
          };

          await client.patchJson(
            `/api/live-artifacts/${artifactId}`,
            patchBody,
          );
          spinner.stop();

          console.log(
            chalk.green(`✓ Source document added to "${artifactId}"`),
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
      },
    );
}
