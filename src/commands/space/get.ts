import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface SpaceItem {
  id: string;
  key: string;
  name: string;
  description: string;
  myRole: string | null;
}

interface SpaceListResponse {
  items: SpaceItem[];
}

export function registerSpaceGetCommand(spaceCmd: Command): void {
  spaceCmd
    .command("get")
    .description("Get space details by ID")
    .argument("<id>", "Space ID")
    .action(async (spaceId: string) => {
      const config = loadConfig();
      const parentOpts = spaceCmd.parent?.opts?.() as { server?: string } | undefined;
      const client = new PaApiClient({
        serverUrl: parentOpts?.server ?? config.serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora("Loading space...").start();
      try {
        const resp = await client.getJson<SpaceListResponse>("/api/spaces");
        spinner.stop();

        const space = resp.items.find((s) => s.id === spaceId);
        if (!space) {
          console.error(chalk.red(`Error: Space "${spaceId}" not found.`));
          process.exit(1);
        }

        console.log(`Space: ${space.name} (${space.key})`);
        console.log(`ID: ${space.id}`);
        if (space.description) {
          console.log(`Description: ${space.description}`);
        }
        console.log(`Your Role: ${space.myRole || "member (default space)"}`);
      } catch (err) {
        spinner.stop();
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
