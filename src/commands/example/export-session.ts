import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import JSZip from "jszip";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

function validateExtractPath(entryPath: string, targetDir: string): string {
  const normalized = entryPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe archive entry: ${entryPath}`);
  }

  const absoluteTargetDir = path.resolve(targetDir);
  const absoluteFilePath = path.resolve(absoluteTargetDir, ...segments);
  const relative = path.relative(absoluteTargetDir, absoluteFilePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe archive entry: ${entryPath}`);
  }

  return absoluteFilePath;
}

async function extractZipToDirectory(zipPath: string, targetDir: string): Promise<number> {
  const zipBuffer = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);

  const absoluteTargetDir = path.resolve(targetDir);
  fs.mkdirSync(absoluteTargetDir, { recursive: true });

  let extractedFileCount = 0;
  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      continue;
    }

    const outputFilePath = validateExtractPath(entryPath, absoluteTargetDir);
    const content = await entry.async("nodebuffer");
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, content);
    extractedFileCount += 1;
  }

  return extractedFileCount;
}

function resolveExtractDir(
  asDir: string | boolean | undefined,
  outputZipPath: string,
): string | null {
  if (asDir === undefined || asDir === false) {
    return null;
  }

  if (typeof asDir === "string" && asDir.trim()) {
    return path.resolve(asDir.trim());
  }

  return path.resolve(outputZipPath.replace(/\.zip$/i, ""));
}

export function registerExampleExportSessionCommand(exampleCmd: Command): void {
  exampleCmd
    .command("export-session")
    .description("Export one session as a read-only example bundle")
    .argument("<id>", "Source session ID")
    .option("-o, --out <path>", "Output bundle zip path", "pa-example-bundle.zip")
    .option(
      "--as-dir [path]",
      "Also extract the exported bundle into a directory (optional path)",
    )
    .action(async (sessionId: string, options: { out?: string; asDir?: string | boolean }) => {
      const config = loadConfig();
      const parentOpts = exampleCmd.parent?.opts?.() as { server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const client = new PaApiClient({
        serverUrl,
        apiKey: config.apiKey,
      });

      const outputPath = path.resolve(options.out ?? "pa-example-bundle.zip");
      const spinner = ora(`Exporting example bundle from session "${sessionId}"...`).start();

      try {
        await client.downloadFile(
          `/api/examples/export-session/${encodeURIComponent(sessionId)}`,
          outputPath,
        );

        const extractDir = resolveExtractDir(options.asDir, outputPath);
        let extractedCount = 0;
        if (extractDir) {
          extractedCount = await extractZipToDirectory(outputPath, extractDir);
        }

        spinner.stop();
        console.log(chalk.green(`✓ Exported example bundle to ${outputPath}`));
        if (extractDir) {
          console.log(
            chalk.green(`✓ Extracted ${extractedCount} files to ${extractDir}`),
          );
        }
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
    });
}
