import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface SpaceListItem {
  id: string;
  key: string;
  name: string;
  description: string;
  myRole: string | null;
  isDefault?: boolean;
}

interface SpaceListResponse {
  items: SpaceListItem[];
}

export function registerSpaceListCommand(spaceCmd: Command): void {
  spaceCmd
    .command("list")
    .description("List spaces you have access to")
    .action(async () => {
      const config = loadConfig();
      const parentOpts = spaceCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });

      const spinner = ora("Loading spaces...").start();
      try {
        const resp = await client.getJson<SpaceListResponse>("/api/spaces");
        spinner.stop();

        const spaces = resp.items;
        if (spaces.length === 0) {
          console.log("No spaces found.");
          return;
        }

        outputData(
          spaces,
          outputFormat,
          ["Name", "Key", "ID", "Role"],
          spaces.map((s) => [
            s.name,
            s.key,
            s.id,
            s.myRole || "-",
          ]),
        );
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
