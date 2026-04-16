import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface PaConfig {
  serverUrl: string;
  apiKey: string;
}

const CONFIG_DIR_NAME = ".pa-cli";
const CONFIG_FILE_NAME = "config.json";

function getDefaultConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

function getConfigPath(configDir?: string): string {
  return path.join(configDir ?? getDefaultConfigDir(), CONFIG_FILE_NAME);
}

export function loadConfig(configDir?: string): PaConfig {
  const configPath = getConfigPath(configDir);
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PaConfig>;
    return {
      serverUrl: parsed.serverUrl ?? "http://localhost:3000",
      apiKey: parsed.apiKey ?? "",
    };
  } catch {
    return { serverUrl: "http://localhost:3000", apiKey: "" };
  }
}

export function saveConfig(config: PaConfig, configDir?: string): void {
  const dir = configDir ?? getDefaultConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, CONFIG_FILE_NAME);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  fs.chmodSync(configPath, 0o600);
}

export function setConfigValue(
  key: string,
  value: string,
  configDir?: string,
): void {
  const config = loadConfig(configDir);
  if (key === "serverUrl") {
    config.serverUrl = value;
  } else if (key === "apiKey") {
    config.apiKey = value;
  } else {
    throw new Error(
      `Unknown config key: "${key}". Supported keys: serverUrl, apiKey`,
    );
  }
  saveConfig(config, configDir);
}

export function maskApiKey(key: string): string {
  if (!key || key.length <= 6) return key;
  return key.slice(0, 5) + "*".repeat(key.length - 8) + key.slice(-3);
}
