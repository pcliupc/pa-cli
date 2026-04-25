import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import {
  buildAgentUploadFormData,
  resolveAndValidateInputPath,
} from "./upload-shared.js";

interface UploadResult {
  agent_id: string;
  name?: string;
  status: "created" | "version_created";
  message?: string;
  version_number?: string;
  current_version_number?: string;
}

export function registerAgentUploadCommand(agentCmd: Command): void {
  agentCmd
    .command("upload")
    .description("Upload a new agent or create a new version for an existing agent")
    .argument("<path>", "Path to config.yaml, .zip file, or agent directory")
    .option("--agent <id>", "Append a new version to an existing logical agent")
    .option("--from <version>", "Record the source version ID or version number")
    .option("--publish", "Set the uploaded version as the current published version")
    .action(async (inputPath: string, options: { agent?: string; from?: string; publish?: boolean }) => {
      const config = loadConfig();
      const parentOpts = agentCmd.parent?.opts?.() as { server?: string } | undefined;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });

      if (options.from && !options.agent) {
        console.error(chalk.red("Error: --from can only be used together with --agent."));
        process.exit(1);
      }

      try {
        resolveAndValidateInputPath(inputPath);
      } catch (err) {
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }

      const spinner = ora("Uploading agent...").start();
      try {
        const formData = buildAgentUploadFormData(inputPath, {
          targetAgentId: options.agent,
          sourceVersionId: options.from,
          publish: options.agent ? options.publish === true : undefined,
        });

        const result = await client.postMultipart<UploadResult>(
          "/api/agents/upload",
          formData,
        );

        spinner.stop();
        const versionText =
          result.version_number && result.current_version_number
            ? `, new version ${result.version_number}, current ${result.current_version_number}`
            : result.version_number
              ? `, version ${result.version_number}`
              : "";
        console.log(
          chalk.green(
            `✓ Agent "${result.agent_id}" uploaded successfully (${result.status}${versionText})`,
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
