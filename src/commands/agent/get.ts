import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { type OutputFormat } from "../../lib/output.js";

export function registerAgentGetCommand(agentCmd: Command): void {
  agentCmd
    .command("get")
    .description("Get agent config.yaml content")
    .argument("<id>", "Agent ID")
    .action(async (agentId: string) => {
      const config = loadConfig();
      const parentOpts = agentCmd.parent?.opts?.() as
        | { output?: string; server?: string }
        | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora(`Fetching agent "${agentId}" config...`).start();
      try {
        const result = await client.getJson<{ yaml: string }>(
          `/api/agents/${agentId}/config`,
        );
        spinner.stop();

        if (outputFormat === "json") {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.yaml);
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
