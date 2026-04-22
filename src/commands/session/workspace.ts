import path from "node:path";
import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface WorkspaceFile {
  path: string;
  name: string;
  type: string;
  size: number;
  modifiedAt: string;
}

interface WorkspaceFilesResponse {
  files: WorkspaceFile[];
}

export function registerSessionWorkspaceCommand(sessionCmd: Command): void {
  const workspaceCmd = sessionCmd
    .command("workspace")
    .description("Inspect and download generated workspace files");

  workspaceCmd
    .command("list")
    .description("List generated workspace files for a session")
    .argument("<id>", "Session ID")
    .action(async (sessionId: string) => {
      const config = loadConfig();
      const parentOpts = sessionCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });
      const spinner = ora("Loading workspace files...").start();

      try {
        const response = await client.getJson<WorkspaceFilesResponse>(
          `/api/workspace/${sessionId}/files`,
        );
        spinner.stop();

        const files = response.files ?? [];
        if (files.length === 0) {
          console.log("No workspace files found.");
          return;
        }

        outputData(
          files,
          outputFormat,
          ["Path", "Type", "Size", "Modified"],
          files.map((file) => [
            file.path,
            file.type,
            String(file.size),
            file.modifiedAt.slice(0, 19).replace("T", " "),
          ]),
        );
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  workspaceCmd
    .command("download")
    .description("Download a generated workspace file from a session")
    .argument("<id>", "Session ID")
    .argument("<workspacePath>", "Workspace-relative file path")
    .option("-o, --output <path>", "Local output path")
    .action(async (sessionId: string, workspacePath: string, options: { output?: string }) => {
      const config = loadConfig();
      const parentOpts = sessionCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const requestedOutput = parentOpts?.output ?? "table";
      const outputFormat = requestedOutput === "json" ? "json" : "table";

      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });
      const cliOutputPath =
        options.output ||
        (requestedOutput !== "table" && requestedOutput !== "json" ? requestedOutput : undefined);
      const outputPath = cliOutputPath || path.basename(workspacePath);
      const spinner = ora("Downloading workspace file...").start();

      try {
        await client.downloadFile(
          `/api/workspace/${sessionId}/serve?path=${encodeURIComponent(workspacePath)}`,
          outputPath,
        );
        spinner.stop();

        if (outputFormat === "json") {
          console.log(
            JSON.stringify(
              {
                sessionId,
                workspacePath,
                outputPath,
              },
              null,
              2,
            ),
          );
          return;
        }

        console.log(
          chalk.green(
            `Saved workspace file ${workspacePath} from ${sessionId} to ${outputPath}`,
          ),
        );
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
