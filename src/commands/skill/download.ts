import path from "node:path";
import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface SkillLookupItem {
  id: string;
  name: string;
}

interface SkillListResponse {
  items: SkillLookupItem[];
}

function normalizeSkills(
  response: SkillLookupItem[] | SkillListResponse,
): SkillLookupItem[] {
  return Array.isArray(response) ? response : response.items;
}

export function registerSkillDownloadCommand(skillCmd: Command): void {
  skillCmd
    .command("download")
    .description("Download a skill as a zip file")
    .argument("<name>", "Skill name")
    .option("-o, --output <path>", "Output file path")
    .action(async (skillName: string, options: { output?: string }) => {
      const config = loadConfig();
      const client = new PaApiClient({
        serverUrl: config.serverUrl,
        apiKey: config.apiKey,
      });
      const outputPath = options.output
        ? path.resolve(options.output)
        : path.resolve(`${skillName}.zip`);

      const spinner = ora(`Downloading skill "${skillName}"...`).start();
      try {
        const response = await client.getJson<SkillLookupItem[] | SkillListResponse>(
          "/api/skills",
        );
        const skill = normalizeSkills(response).find((item) => item.name === skillName);
        if (!skill) {
          throw new Error(`Skill "${skillName}" not found.`);
        }

        await client.downloadFile(
          `/api/skills/${skill.id}/download`,
          outputPath,
        );
        spinner.succeed(`Downloaded skill "${skillName}" to ${outputPath}`);
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
