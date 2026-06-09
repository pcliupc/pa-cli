import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

function resolveTargetDir(input?: string): string {
  return input
    ? path.resolve(input)
    : path.resolve(process.cwd(), ".claude", "skills");
}

export function registerSkillInstallCommand(skillCmd: Command): void {
  skillCmd
    .command("install")
    .description("Download and install a skill into a local skills directory")
    .argument("<name>", "Skill name")
    .option(
      "--dir <path>",
      "Target skills directory (default: .claude/skills in current directory)",
    )
    .action(async (skillName: string, options: { dir?: string }) => {
      const config = loadConfig();
      const client = new PaApiClient({
        serverUrl: config.serverUrl,
        apiKey: config.apiKey,
      });
      const targetDir = resolveTargetDir(options.dir);
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-skill-install-"));
      const tempZip = path.join(tempDir, `${skillName}.zip`);
      const installDir = path.join(targetDir, skillName);
      const spinner = ora(`Installing skill "${skillName}"...`).start();

      try {
        const response = await client.getJson<SkillLookupItem[] | SkillListResponse>(
          "/api/skills",
        );
        const skill = normalizeSkills(response).find((item) => item.name === skillName);
        if (!skill) {
          throw new Error(`Skill "${skillName}" not found.`);
        }

        await client.downloadFile(`/api/skills/${skill.id}/download`, tempZip);
        fs.mkdirSync(installDir, { recursive: true });
        execFileSync(
          "unzip",
          ["-oq", tempZip, "-d", installDir],
          { stdio: "ignore" },
        );

        spinner.succeed(`Installed skill "${skillName}" to ${installDir}`);
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
}
