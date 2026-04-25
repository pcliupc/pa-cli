import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";
import {
  buildAgentUploadFormData,
  resolveAndValidateInputPath,
} from "./upload-shared.js";

interface AgentVersionListItem {
  version_id: string;
  version_number: string;
  version_index: number;
  source_version_id: string | null;
  creatorName?: string | null;
  createdAt: string;
  is_current: boolean;
}

interface AgentVersionListResponse {
  agent_id: string;
  current_version_id: string | null;
  items: AgentVersionListItem[];
}

interface AgentVersionDetailResponse {
  agent_id: string;
  agent_name?: string;
  version_id: string;
  version_number: string;
  version_index: number;
  source_version_id: string | null;
  config: Record<string, unknown>;
  stages?: unknown;
  is_current: boolean;
  creatorName?: string | null;
  createdAt: string;
}

interface UploadResult {
  agent_id: string;
  status: "created" | "version_created";
  version_number?: string;
  current_version_number?: string;
}

interface PublishResult {
  agent_id: string;
  current_version_id: string;
  current_version_number: string;
}

export function registerAgentVersionCommands(agentCmd: Command): void {
  const versionCmd = agentCmd.command("version").description("Manage immutable agent versions");

  versionCmd
    .command("list")
    .description("List versions for a logical agent")
    .argument("<id>", "Agent ID")
    .action(async (agentId: string) => {
      const config = loadConfig();
      const parentOpts = agentCmd.parent?.opts?.() as
        | { output?: string; server?: string }
        | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });

      const spinner = ora(`Loading versions for "${agentId}"...`).start();
      try {
        const response = await client.getJson<AgentVersionListResponse>(
          `/api/agents/${agentId}/versions`,
        );
        spinner.stop();

        if (response.items.length === 0) {
          console.log(`No versions found for agent "${agentId}".`);
          return;
        }

        outputData(
          response.items,
          outputFormat,
          ["Version", "Current", "Source", "Creator", "Created"],
          response.items.map((version) => [
            version.version_number,
            version.is_current ? "✓" : "",
            version.source_version_id || "-",
            version.creatorName || "-",
            version.createdAt.slice(0, 10),
          ]),
        );
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
    });

  versionCmd
    .command("get")
    .description("Get a specific agent version snapshot")
    .argument("<id>", "Agent ID")
    .argument("<version>", "Version ID or version number")
    .action(async (agentId: string, versionRef: string) => {
      const config = loadConfig();
      const parentOpts = agentCmd.parent?.opts?.() as
        | { output?: string; server?: string }
        | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });

      const spinner = ora(`Loading version "${versionRef}"...`).start();
      try {
        const version = await client.getJson<AgentVersionDetailResponse>(
          `/api/agents/${agentId}/versions/${versionRef}`,
        );
        spinner.stop();

        if (outputFormat === "json") {
          console.log(JSON.stringify(version, null, 2));
          return;
        }

        console.log(chalk.bold(`${version.agent_name || agentId} ${version.version_number}`));
        console.log(`  Agent:   ${version.agent_id}`);
        console.log(`  Version: ${version.version_number} (${version.version_id})`);
        console.log(`  Current: ${version.is_current ? "yes" : "no"}`);
        console.log(`  Source:  ${version.source_version_id || "-"}`);
        console.log(`  Creator: ${version.creatorName || "-"}`);
        console.log(`  Created: ${version.createdAt.slice(0, 19).replace("T", " ")}`);
        console.log("");
        console.log(JSON.stringify(version.config, null, 2));
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
    });

  versionCmd
    .command("create")
    .description("Create a new version for an existing logical agent")
    .argument("<id>", "Agent ID")
    .argument("<path>", "Path to config.yaml, .zip file, or agent directory")
    .option("--from <version>", "Record the source version ID or version number")
    .option("--publish", "Set the new version as the current published version")
    .action(async (agentId: string, inputPath: string, options: { from?: string; publish?: boolean }) => {
      const config = loadConfig();
      const parentOpts = agentCmd.parent?.opts?.() as { server?: string } | undefined;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });

      try {
        resolveAndValidateInputPath(inputPath);
      } catch (err) {
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }

      const spinner = ora(`Creating a new version for "${agentId}"...`).start();
      try {
        const formData = buildAgentUploadFormData(inputPath, {
          targetAgentId: agentId,
          sourceVersionId: options.from,
          publish: options.publish === true,
        });
        const result = await client.postMultipart<UploadResult>(
          "/api/agents/upload",
          formData,
        );
        spinner.stop();
        const versionText =
          result.version_number && result.current_version_number
            ? `new version ${result.version_number}, current ${result.current_version_number}`
            : result.version_number || result.status;
        console.log(chalk.green(`✓ Agent "${result.agent_id}" updated successfully (${versionText})`));
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
    });

  versionCmd
    .command("publish")
    .description("Publish a specific version as the current default version")
    .argument("<id>", "Agent ID")
    .argument("<version>", "Version ID or version number")
    .action(async (agentId: string, versionRef: string) => {
      const config = loadConfig();
      const parentOpts = agentCmd.parent?.opts?.() as { server?: string } | undefined;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora(`Publishing version "${versionRef}"...`).start();
      try {
        const result = await client.postJson<PublishResult>(
          `/api/agents/${agentId}/versions/${versionRef}/publish`,
        );
        spinner.stop();
        console.log(
          chalk.green(
            `✓ Agent "${result.agent_id}" now publishes ${result.current_version_number}`,
          ),
        );
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
    });
}
