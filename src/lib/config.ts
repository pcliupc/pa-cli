import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface PaConfig {
  serverUrl: string;
  apiKey: string;
}

export interface PaProfile extends PaConfig {
  name: string;
}

const CONFIG_DIR_NAME = ".pa-cli";
const CONFIG_FILE_NAME = "config.json";
const PROFILES_DIR_NAME = "profiles";
const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;
const RESERVED_NAMES = new Set(["default"]);

function getDefaultConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

function getConfigPath(configDir?: string): string {
  return path.join(configDir ?? getDefaultConfigDir(), CONFIG_FILE_NAME);
}

function getProfilesDir(configDir?: string): string {
  return path.join(configDir ?? getDefaultConfigDir(), PROFILES_DIR_NAME);
}

function getProfilePath(name: string, configDir?: string): string {
  return path.join(getProfilesDir(configDir), `${name}.json`);
}

interface RootConfig {
  currentProfile?: string;
}

interface LegacyConfig extends PaConfig {
  currentProfile?: string;
}

function readRootConfig(configDir?: string): RootConfig {
  const configPath = getConfigPath(configDir);
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as RootConfig;
  } catch {
    return {};
  }
}

function writeRootConfig(root: RootConfig, configDir?: string): void {
  const dir = configDir ?? getDefaultConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, CONFIG_FILE_NAME);
  fs.writeFileSync(configPath, JSON.stringify(root, null, 2), "utf-8");
  fs.chmodSync(configPath, 0o600);
}

function readProfileFile(
  name: string,
  configDir?: string,
): PaConfig | undefined {
  const filePath = getProfilePath(name, configDir);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as PaConfig;
  } catch {
    return undefined;
  }
}

function writeProfileFile(
  name: string,
  config: PaConfig,
  configDir?: string,
): void {
  const profilesDir = getProfilesDir(configDir);
  fs.mkdirSync(profilesDir, { recursive: true });
  const filePath = path.join(profilesDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  fs.chmodSync(filePath, 0o600);
}

function validateProfileName(name: string): void {
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid profile name "${name}". Use only letters, numbers, hyphens, and underscores (max 32 characters).`,
    );
  }
  if (RESERVED_NAMES.has(name)) {
    throw new Error(`Profile name "${name}" is reserved.`);
  }
}

/**
 * Detect and migrate legacy single-config format.
 * Old format: { serverUrl, apiKey } in config.json
 * New format: config.json has { currentProfile }, actual config in profiles/<name>.json
 */
function migrateIfNeeded(configDir?: string): void {
  const configPath = getConfigPath(configDir);
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf-8");
  } catch {
    // No config file at all — nothing to migrate
    return;
  }

  let parsed: LegacyConfig;
  try {
    parsed = JSON.parse(raw) as LegacyConfig;
  } catch {
    // Corrupted config file — skip migration
    return;
  }

  // Already new format (has currentProfile and no serverUrl at root level)
  if (parsed.currentProfile !== undefined && parsed.serverUrl === undefined) {
    return;
  }

  // Legacy format: has serverUrl/apiKey at root level
  if (parsed.serverUrl !== undefined || parsed.apiKey !== undefined) {
    const profileConfig: PaConfig = {
      serverUrl: parsed.serverUrl ?? "http://localhost:3000",
      apiKey: parsed.apiKey ?? "",
    };

    // Write the profile file
    writeProfileFile("local", profileConfig, configDir);

    // Replace root config with new format
    writeRootConfig({ currentProfile: "local" }, configDir);
  }
}

export function loadConfig(configDir?: string): PaConfig {
  migrateIfNeeded(configDir);

  const root = readRootConfig(configDir);
  const profileName = root.currentProfile;

  if (!profileName) {
    return { serverUrl: "http://localhost:3000", apiKey: "" };
  }

  const profileConfig = readProfileFile(profileName, configDir);
  if (!profileConfig) {
    return { serverUrl: "http://localhost:3000", apiKey: "" };
  }

  return {
    serverUrl: profileConfig.serverUrl ?? "http://localhost:3000",
    apiKey: profileConfig.apiKey ?? "",
  };
}

export function setConfigValue(
  key: string,
  value: string,
  configDir?: string,
): void {
  migrateIfNeeded(configDir);

  const root = readRootConfig(configDir);
  const profileName = root.currentProfile;

  if (!profileName) {
    throw new Error(
      "No active profile. Run 'pa config profile add <name>' to create one.",
    );
  }

  const profileConfig = readProfileFile(profileName, configDir) ?? {
    serverUrl: "http://localhost:3000",
    apiKey: "",
  };

  if (key === "serverUrl") {
    profileConfig.serverUrl = value;
  } else if (key === "apiKey") {
    profileConfig.apiKey = value;
  } else {
    throw new Error(
      `Unknown config key: "${key}". Supported keys: serverUrl, apiKey`,
    );
  }

  writeProfileFile(profileName, profileConfig, configDir);
}

export function listProfiles(configDir?: string): PaProfile[] {
  migrateIfNeeded(configDir);
  const profilesDir = getProfilesDir(configDir);
  const result: PaProfile[] = [];

  try {
    const files = fs.readdirSync(profilesDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const name = file.slice(0, -5);
      const config = readProfileFile(name, configDir);
      if (config) {
        result.push({ name, ...config });
      }
    }
  } catch {
    // profiles directory doesn't exist yet
  }

  return result;
}

export function addProfile(
  profile: PaProfile,
  configDir?: string,
): void {
  validateProfileName(profile.name);

  const existing = readProfileFile(profile.name, configDir);
  if (existing) {
    throw new Error(`Profile "${profile.name}" already exists.`);
  }

  writeProfileFile(
    profile.name,
    { serverUrl: profile.serverUrl, apiKey: profile.apiKey },
    configDir,
  );

  // If this is the first profile, auto-set as current
  const root = readRootConfig(configDir);
  if (!root.currentProfile) {
    writeRootConfig({ currentProfile: profile.name }, configDir);
  }
}

export function removeProfile(name: string, configDir?: string): void {
  validateProfileName(name);
  const root = readRootConfig(configDir);
  if (root.currentProfile === name) {
    throw new Error(
      `Cannot remove the currently active profile "${name}". Switch to another profile first.`,
    );
  }

  const filePath = getProfilePath(name, configDir);
  try {
    fs.unlinkSync(filePath);
  } catch {
    throw new Error(`Profile "${name}" not found.`);
  }
}

export function useProfile(
  name: string,
  configDir?: string,
): PaConfig {
  validateProfileName(name);
  const profileConfig = readProfileFile(name, configDir);
  if (!profileConfig) {
    throw new Error(
      `Profile "${name}" not found. Run 'pa config profile add ${name}' to create it.`,
    );
  }

  writeRootConfig({ currentProfile: name }, configDir);
  return profileConfig;
}

export function getCurrentProfileName(
  configDir?: string,
): string | null {
  migrateIfNeeded(configDir);
  const root = readRootConfig(configDir);
  return root.currentProfile ?? null;
}

export function maskApiKey(key: string): string {
  if (!key || key.length <= 6) return key;
  return key.slice(0, 5) + "*".repeat(key.length - 8) + key.slice(-3);
}
