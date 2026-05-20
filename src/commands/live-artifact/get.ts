import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { type OutputFormat } from "../../lib/output.js";

interface LiveArtifactCurrentVersion {
  id: string;
  version: number;
  createdAt: string;
  bundlePath: string;
}

interface LiveArtifactSourceDocument {
  id: string;
  [key: string]: unknown;
}

interface LiveArtifactDetail {
  id: string;
  title: string;
  artifactType: string;
  packageFormat: string;
  runtimeTarget: string;
  runtimeMode: string;
  status: string;
  visibility: string;
  currentVersion: LiveArtifactCurrentVersion | null;
  sourceDocuments: LiveArtifactSourceDocument[];
  canWrite: boolean;
  [key: string]: unknown;
}

interface LiveArtifactGetResponse {
  artifact: LiveArtifactDetail;
}

export function registerLiveArtifactGetCommand(
  liveArtifactCmd: Command,
): void {
  liveArtifactCmd
    .command("get")
    .description("Get live artifact details")
    .argument("<id>", "Live artifact ID")
    .action(async (artifactId: string) => {
      const config = loadConfig();
      const parentOpts = liveArtifactCmd.parent?.opts?.() as
        | { output?: string; server?: string }
        | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "json") as OutputFormat;

      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora(`Fetching live artifact "${artifactId}"...`).start();
      try {
        const result = await client.getJson<LiveArtifactGetResponse>(
          `/api/live-artifacts/${artifactId}`,
        );
        spinner.stop();

        if (outputFormat === "json") {
          console.log(JSON.stringify(result.artifact, null, 2));
        } else {
          const a = result.artifact;
          const pairs: [string, string][] = [
            ["ID", a.id],
            ["Title", a.title],
            ["Type", a.artifactType],
            ["Package Format", a.packageFormat],
            ["Runtime Target", a.runtimeTarget],
            ["Runtime Mode", a.runtimeMode],
            ["Status", a.status],
            ["Visibility", a.visibility],
            [
              "Current Version",
              a.currentVersion ? String(a.currentVersion.version) : "-",
            ],
            [
              "Version Created",
              a.currentVersion
                ? a.currentVersion.createdAt.slice(0, 10)
                : "-",
            ],
            ["Can Write", String(a.canWrite)],
            [
              "Source Documents",
              String(a.sourceDocuments?.length ?? 0),
            ],
          ];
          for (const [label, value] of pairs) {
            console.log(`${label}: ${value}`);
          }
        }
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
