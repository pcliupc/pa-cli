import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface ImportResult {
  id: string;
  name: string;
}

export function registerSkillImportCommand(skillCmd: Command): void {
  skillCmd
    .command("import")
    .description("Import a skill (zip or directory)")
    .argument("<path>", "Path to .zip file or skill directory")
    .option("--overwrite", "Overwrite existing skill with same name")
    .option("--category <category>", "Category (default: utility)")
    .option("--tags <tags>", "Comma-separated tags")
    .action(
      async (
        inputPath: string,
        options: { overwrite?: boolean; category?: string; tags?: string },
      ) => {
        const config = loadConfig();
        const client = new PaApiClient({
          serverUrl: config.serverUrl,
          apiKey: config.apiKey,
        });

        const resolvedPath = path.resolve(inputPath);
        if (!fs.existsSync(resolvedPath)) {
          console.error(chalk.red(`Error: Path not found: ${resolvedPath}`));
          process.exit(1);
        }

        const spinner = ora("Importing skill...").start();
        try {
          const formData = new FormData();
          formData.append("conflictMode", "error");

          if (options.category) {
            formData.append("category", options.category);
          }
          if (options.tags) {
            formData.append("tags", options.tags);
          }

          const stat = fs.statSync(resolvedPath);
          if (
            stat.isFile() &&
            path.extname(resolvedPath).toLowerCase() === ".zip"
          ) {
            const buffer = fs.readFileSync(resolvedPath);
            formData.append(
              "files[]",
              new Blob([buffer]),
              path.basename(resolvedPath),
            );
          } else if (stat.isDirectory()) {
            const files = walkDir(resolvedPath);
            if (files.length === 0) {
              spinner.stop();
              console.error(chalk.red("Error: Directory is empty."));
              process.exit(1);
            }
            for (const filePath of files) {
              const buffer = fs.readFileSync(filePath);
              const relativePath = path.relative(resolvedPath, filePath);
              formData.append("files[]", new Blob([buffer]), relativePath);
              formData.append("paths[]", relativePath);
            }
          } else {
            spinner.stop();
            console.error(
              chalk.red(
                "Error: Unsupported path. Provide a .zip file or directory.",
              ),
            );
            process.exit(1);
          }

          const result = await client.postMultipart<ImportResult>(
            "/api/skills/import",
            formData,
          );

          spinner.stop();
          console.log(
            chalk.green(`✓ Skill "${result.name}" imported successfully`),
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
      },
    );
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}
