import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface UpdateOptions {
  status?: string;
  title?: string;
}

interface UpdateResponse {
  artifact: {
    id: string;
    title: string;
    status: string;
    [key: string]: unknown;
  };
}

export function registerLiveArtifactUpdateCommand(
  liveArtifactCmd: Command,
): void {
  liveArtifactCmd
    .command("update")
    .description("Update a live artifact")
    .argument("<id>", "Live artifact ID")
    .option("--status <val>", "New status: published | archived")
    .option("--title <val>", "New title")
    .action(async (artifactId: string, options: UpdateOptions) => {
      if (!options.status && !options.title) {
        console.error(
          chalk.red(
            "Error: at least one of --status or --title must be specified.",
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

      const spinner = ora(`Updating live artifact "${artifactId}"...`).start();
      try {
        const body: Record<string, string> = {};
        if (options.status) {
          body.status = options.status;
        }
        if (options.title) {
          body.title = options.title;
        }

        const result = await client.patchJson<UpdateResponse>(
          `/api/live-artifacts/${artifactId}`,
          body,
        );
        spinner.stop();

        console.log(
          chalk.green(`✓ Live artifact "${result.artifact.id}" updated`),
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
