import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import JSZip from "jszip";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";

interface ExampleImportResult {
  ok: boolean;
  example: {
    id: string;
    title: string;
    counts?: {
      files?: number;
      artifacts?: number;
      liveArtifacts?: number;
    };
  };
  space?: {
    id: string;
    key: string;
    name?: string;
  };
}

function toPosixRelativePath(baseDir: string, absolutePath: string): string {
  const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, "/");
  const normalized = relativePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .join("/");
  return normalized;
}

function walkDirectory(inputDir: string): string[] {
  const entries = fs.readdirSync(inputDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(inputDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(absolutePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function createZipFromDirectory(inputDir: string): Promise<Buffer> {
  const files = walkDirectory(inputDir);
  if (files.length === 0) {
    throw new Error("Directory is empty.");
  }

  const zip = new JSZip();
  for (const absoluteFile of files) {
    const relativePath = toPosixRelativePath(inputDir, absoluteFile);
    if (!relativePath) {
      continue;
    }
    const content = fs.readFileSync(absoluteFile);
    zip.file(relativePath, content);
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

async function readImportBundle(inputPath: string): Promise<{ buffer: Buffer; filename: string }> {
  const stat = fs.statSync(inputPath);
  if (stat.isDirectory()) {
    const buffer = await createZipFromDirectory(inputPath);
    const folderName = path.basename(path.resolve(inputPath));
    return {
      buffer,
      filename: `${folderName || "example-bundle"}.zip`,
    };
  }

  if (stat.isFile() && path.extname(inputPath).toLowerCase() === ".zip") {
    return {
      buffer: fs.readFileSync(inputPath),
      filename: path.basename(inputPath),
    };
  }

  throw new Error("Unsupported input path. Provide a .zip file or a directory.");
}

function toBlobPart(buffer: Buffer): ArrayBuffer {
  const copy = Uint8Array.from(buffer);
  return copy.buffer;
}

export function registerExampleImportCommand(exampleCmd: Command): void {
  exampleCmd
    .command("import")
    .description("Import an example bundle (.zip or bundle directory)")
    .argument("<path>", "Path to bundle .zip or bundle directory")
    .option("--space <spaceKey>", "Import to target space key")
    .option("--force", "Overwrite existing example in target space when digest matches")
    .option("--require-agent-match", "Require target platform has matching agent and version")
    .action(
      async (
        inputPath: string,
        options: { space?: string; force?: boolean; requireAgentMatch?: boolean },
      ) => {
        const config = loadConfig();
        const parentOpts = exampleCmd.parent?.opts?.() as { server?: string } | undefined;
        const serverUrl = parentOpts?.server ?? config.serverUrl;
        const client = new PaApiClient({
          serverUrl,
          apiKey: config.apiKey,
        });

        const resolvedPath = path.resolve(inputPath);
        if (!fs.existsSync(resolvedPath)) {
          console.error(chalk.red(`Error: Path not found: ${resolvedPath}`));
          process.exit(1);
        }

        const spinner = ora("Importing example bundle...").start();
        try {
          const bundle = await readImportBundle(resolvedPath);
          const formData = new FormData();
          formData.append("bundle", new Blob([toBlobPart(bundle.buffer)]), bundle.filename);

          if (options.space) {
            formData.append("spaceKey", options.space);
          }
          if (options.force) {
            formData.append("force", "true");
          }
          if (options.requireAgentMatch) {
            formData.append("requireAgentMatch", "true");
          }

          const result = await client.postMultipart<ExampleImportResult>(
            "/api/examples/import",
            formData,
          );

          spinner.stop();

          const counts = result.example.counts;
          const targetSpace = result.space?.key ?? options.space ?? "default";
          console.log(
            chalk.green(
              `✓ Imported example "${result.example.title}" (${result.example.id}) into space "${targetSpace}"`,
            ),
          );
          if (counts) {
            console.log(
              `  files=${counts.files ?? 0}, artifacts=${counts.artifacts ?? 0}, liveArtifacts=${counts.liveArtifacts ?? 0}`,
            );
          }
        } catch (err) {
          spinner.stop();
          console.error(
            chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
          );
          process.exit(1);
        }
      },
    );
}
