import { Command } from "commander";
import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface SkillListItem {
  name: string;
  displayName: string;
  version: string;
  category: string;
  downloads: number;
  updatedAt: string;
}

interface SkillListResponse {
  items: SkillListItem[];
}

export function registerSkillListCommand(skillCmd: Command): void {
  skillCmd
    .command("list")
    .description("List all skills")
    .option("--category <category>", "Filter by category")
    .option("--search <keyword>", "Search by keyword")
    .option("--space <id>", "Filter by space ID")
    .action(async (options: { category?: string; search?: string; space?: string }) => {
      const config = loadConfig();
      const parentOpts = skillCmd.parent?.parent?.opts?.() as
        | { output?: string; server?: string }
        | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const spinner = ora("Loading skills...").start();
      try {
        const params = new URLSearchParams();
        if (options.category) params.set("category", options.category);
        if (options.search) params.set("search", options.search);
        if (options.space) params.set("spaceId", options.space);
        const qs = params.toString();
        const resp = await client.getJson<SkillListItem[] | SkillListResponse>(
          `/api/skills${qs ? `?${qs}` : ""}`,
        );
        const skills = Array.isArray(resp) ? resp : resp.items;

        spinner.stop();

        if (skills.length === 0) {
          console.log("No skills found.");
          return;
        }

        outputData(
          skills,
          outputFormat,
          [
            "Name",
            "Display Name",
            "Version",
            "Category",
            "Downloads",
            "Updated",
          ],
          skills.map((s) => [
            s.name,
            s.displayName,
            s.version,
            s.category,
            String(s.downloads),
            s.updatedAt ? s.updatedAt.slice(0, 10) : "-",
          ]),
        );
      } catch (err) {
        spinner.stop();
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });
}
