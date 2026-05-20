import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface PublishOptions {
  session: string;
  dir: string;
  title?: string;
}

interface PublishResponse {
  artifact: {
    id: string;
    title: string;
    artifactType: string;
    status: string;
    version: number;
  };
}

export function registerLiveArtifactPublishCommand(
  liveArtifactCmd: Command,
): void {
  liveArtifactCmd
    .command("publish")
    .description("Publish a live artifact from a session workspace")
    .requiredOption("--session <id>", "Source session ID")
    .requiredOption("--dir <path>", "Bundle directory within session workspace")
    .option("--title <title>", "Artifact title")
    .action(async (options: PublishOptions) => {
      if (!options.session || !options.dir) {
        console.error(
          chalk.red(
            `Error: --session and --dir are required.`,
          ),
        );
        process.exit(1);
      }

      const config = loadConfig();
      const parentOpts = liveArtifactCmd.parent?.opts?.() as
        | { output?: string; server?: string }
        | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;

      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora("Publishing live artifact...").start();
      try {
        const body: Record<string, string> = {
          sessionId: options.session,
          bundleDir: options.dir,
        };
        if (options.title) {
          body.title = options.title;
        }

        const result = await client.postJson<PublishResponse>(
          "/api/live-artifacts/publish",
          body,
        );
        spinner.stop();

        const { artifact } = result;
        console.log(
          `✓ Live artifact "${artifact.id}" published (type: ${artifact.artifactType}, version: ${artifact.version})`,
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
