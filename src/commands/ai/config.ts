import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";

import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

type SupportedAIProvider = "qwen" | "glm";

type PricingConfig = Record<
  string,
  {
    inputPerMillion: number;
    outputPerMillion: number;
    cacheCreationPerMillion: number;
    cacheReadPerMillion: number;
    currency: string;
    pricingVersion: string;
    enabled: boolean;
  }
>;

type StoredConfig = {
  id: string;
  provider: SupportedAIProvider;
  baseUrl: string | null;
  fastModel: string;
  strongModel: string;
  pricingConfig: PricingConfig;
  enabled: boolean;
  hasApiKey: boolean;
  keyHint: string | null;
  createdAt: string;
  updatedAt: string;
};

type EffectiveConfig = {
  provider: SupportedAIProvider;
  baseUrl: string | null;
  fastModel: string;
  strongModel: string;
  pricingConfig: PricingConfig;
  source: "db" | "env";
  keyHint: string | null;
};

type AIConfigViewResponse = {
  stored: StoredConfig | null;
  effective: EffectiveConfig;
};

type DeleteAIConfigResponse = AIConfigViewResponse & {
  deletedCount: number;
};

const TEMPLATE_BY_PROVIDER: Record<SupportedAIProvider, Record<string, unknown>> = {
  qwen: {
    provider: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    fastModel: "qwen3.6-plus",
    strongModel: "qwen-max",
    enabled: true,
    apiKey: "sk-please-replace",
    pricingConfig: {
      "qwen3.6-plus": {
        inputPerMillion: 8,
        outputPerMillion: 24,
        cacheCreationPerMillion: 2,
        cacheReadPerMillion: 0.5,
        currency: "CNY",
        pricingVersion: "model-studio-2026-07",
        enabled: true,
      },
    },
  },
  glm: {
    provider: "glm",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    fastModel: "glm-4.5-air",
    strongModel: "glm-4.5",
    enabled: true,
    apiKey: "sk-please-replace",
    pricingConfig: {
      "glm-4.5": {
        inputPerMillion: 10,
        outputPerMillion: 30,
        cacheCreationPerMillion: 2.5,
        cacheReadPerMillion: 0.6,
        currency: "CNY",
        pricingVersion: "glm-2026-07",
        enabled: true,
      },
    },
  },
};

function resolveRuntimeOptions(aiCmd: Command): {
  outputFormat: OutputFormat;
  serverUrl: string;
  apiKey: string;
} {
  const config = loadConfig();
  const rootOpts = aiCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
  const outputFormat = rootOpts?.output === "json" ? "json" : "table";

  return {
    outputFormat,
    serverUrl: rootOpts?.server ?? config.serverUrl,
    apiKey: config.apiKey,
  };
}

function createClient(serverUrl: string, apiKey: string): PaApiClient {
  return new PaApiClient({ serverUrl, apiKey });
}

function countPricingModels(pricingConfig: PricingConfig | null | undefined): number {
  if (!pricingConfig || typeof pricingConfig !== "object") {
    return 0;
  }
  return Object.keys(pricingConfig).length;
}

function loadJsonObjectFile(filePath: string): Record<string, unknown> {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(resolvedPath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON file: ${resolvedPath}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Config file must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSupportedProvider(value: unknown): value is SupportedAIProvider {
  return value === "qwen" || value === "glm";
}

async function confirmPrompt(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export function registerAiConfigCommands(aiCmd: Command): void {
  const configCmd = aiCmd.command("config").description("Manage PA AI provider config");

  configCmd
    .command("get")
    .description("Get current PA AI provider config")
    .action(async () => {
      const { outputFormat, serverUrl, apiKey } = resolveRuntimeOptions(aiCmd);
      const client = createClient(serverUrl, apiKey);
      const spinner = ora("Loading AI config...").start();

      try {
        const response = await client.getJson<AIConfigViewResponse>("/api/admin/ai-provider-config");
        spinner.stop();

        outputData(
          response,
          outputFormat,
          ["Config", "Provider", "Base URL", "Fast Model", "Strong Model", "Enabled", "Key Hint", "Source", "Pricing"],
          [
            [
              "stored",
              response.stored?.provider ?? "-",
              response.stored?.baseUrl ?? "-",
              response.stored?.fastModel ?? "-",
              response.stored?.strongModel ?? "-",
              response.stored ? String(response.stored.enabled) : "-",
              response.stored?.keyHint ?? "-",
              response.stored ? "db" : "-",
              String(countPricingModels(response.stored?.pricingConfig)),
            ],
            [
              "effective",
              response.effective.provider,
              response.effective.baseUrl ?? "-",
              response.effective.fastModel,
              response.effective.strongModel,
              "-",
              response.effective.keyHint ?? "-",
              response.effective.source,
              String(countPricingModels(response.effective.pricingConfig)),
            ],
          ],
        );
      } catch (error) {
        spinner.stop();
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  configCmd
    .command("add")
    .description("Create AI config (fails if config already exists)")
    .requiredOption("--file <path>", "Path to AI config JSON file")
    .action(async (options: { file: string }) => {
      let payload: Record<string, unknown>;
      try {
        payload = loadJsonObjectFile(options.file);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
        return;
      }

      if (!isNonEmptyString(payload.apiKey)) {
        console.error(chalk.red("Error: add requires a non-empty apiKey in the JSON file."));
        process.exit(1);
        return;
      }

      const { serverUrl, apiKey } = resolveRuntimeOptions(aiCmd);
      const client = createClient(serverUrl, apiKey);
      const spinner = ora("Creating AI config...").start();

      try {
        const response = await client.postJson<AIConfigViewResponse>(
          "/api/admin/ai-provider-config",
          payload,
        );
        spinner.stop();
        console.log(
          chalk.green(
            `✓ AI config created (${response.stored?.provider ?? response.effective.provider}:${response.stored?.strongModel ?? response.effective.strongModel})`,
          ),
        );
      } catch (error) {
        spinner.stop();
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  configCmd
    .command("update")
    .description("Update AI config (fails if config does not exist)")
    .requiredOption("--file <path>", "Path to AI config JSON file")
    .action(async (options: { file: string }) => {
      let payload: Record<string, unknown>;
      try {
        payload = loadJsonObjectFile(options.file);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
        return;
      }

      const { serverUrl, apiKey } = resolveRuntimeOptions(aiCmd);
      const client = createClient(serverUrl, apiKey);
      const spinner = ora("Updating AI config...").start();

      try {
        const response = await client.patchJson<AIConfigViewResponse>(
          "/api/admin/ai-provider-config",
          payload,
        );
        spinner.stop();
        console.log(
          chalk.green(
            `✓ AI config updated (${response.stored?.provider ?? response.effective.provider}:${response.stored?.strongModel ?? response.effective.strongModel})`,
          ),
        );
      } catch (error) {
        spinner.stop();
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  configCmd
    .command("delete")
    .description("Delete AI config (hard delete, fallback to env)")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (options: { force?: boolean }) => {
      if (!options.force) {
        const confirmed = await confirmPrompt("Delete AI config and fallback to .env?");
        if (!confirmed) {
          console.log("Cancelled.");
          return;
        }
      }

      const { serverUrl, apiKey } = resolveRuntimeOptions(aiCmd);
      const client = createClient(serverUrl, apiKey);
      const spinner = ora("Deleting AI config...").start();

      try {
        const response = await client.deleteJson<DeleteAIConfigResponse>("/api/admin/ai-provider-config");
        spinner.stop();
        console.log(
          chalk.green(
            `✓ AI config deleted. Runtime now falls back to .env (source: ${response.effective.source}).`,
          ),
        );
      } catch (error) {
        spinner.stop();
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  configCmd
    .command("template")
    .description("Print or write AI config JSON template")
    .option("--provider <provider>", "Template provider: qwen | glm", "qwen")
    .option("-o, --out <path>", "Write template JSON to file")
    .action((options: { provider?: string; out?: string }) => {
      const provider = options.provider ?? "qwen";
      if (!isSupportedProvider(provider)) {
        console.error(chalk.red("Error: provider must be qwen or glm."));
        process.exit(1);
        return;
      }

      const content = `${JSON.stringify(TEMPLATE_BY_PROVIDER[provider], null, 2)}\n`;

      if (options.out) {
        const outputPath = path.resolve(options.out);
        if (fs.existsSync(outputPath)) {
          console.error(chalk.red(`Error: file already exists: ${outputPath}`));
          process.exit(1);
          return;
        }

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, content, "utf-8");
        console.log(chalk.green(`✓ Template written: ${outputPath}`));
        return;
      }

      process.stdout.write(content);
    });
}
