import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadConfig,
  setConfigValue,
  maskApiKey,
  listProfiles,
  addProfile,
  removeProfile,
  useProfile,
  getCurrentProfileName,
} from "../../src/lib/config.js";

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-test-"));

function writeRootConfigDirect(
  root: { currentProfile?: string; serverUrl?: string; apiKey?: string },
  configDir: string,
): void {
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify(root, null, 2), "utf-8");
}

describe("maskApiKey", () => {
  it("masks middle of key", () => {
    expect(maskApiKey("pa_abcdef123456")).toBe("pa_ab*******456");
  });

  it("returns empty for empty string", () => {
    expect(maskApiKey("")).toBe("");
  });

  it("handles short keys", () => {
    expect(maskApiKey("pa_ab")).toBe("pa_ab");
  });
});

describe("profile file I/O", () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("listProfiles returns empty when no profiles exist", () => {
    const profiles = listProfiles(dir);
    expect(profiles).toEqual([]);
  });

  it("addProfile creates a profile file and listProfiles returns it", () => {
    addProfile(
      { name: "local", serverUrl: "http://localhost:3000", apiKey: "pa_dev" },
      dir,
    );
    const profiles = listProfiles(dir);
    expect(profiles).toEqual([
      { name: "local", serverUrl: "http://localhost:3000", apiKey: "pa_dev" },
    ]);
  });

  it("addProfile throws on duplicate name", () => {
    addProfile(
      { name: "local", serverUrl: "http://localhost:3000", apiKey: "" },
      dir,
    );
    expect(() =>
      addProfile(
        { name: "local", serverUrl: "http://other:3000", apiKey: "" },
        dir,
      ),
    ).toThrow(/already exists/);
  });

  it("addProfile throws on invalid name characters", () => {
    expect(() =>
      addProfile(
        { name: "bad name!", serverUrl: "http://x", apiKey: "" },
        dir,
      ),
    ).toThrow(/invalid profile name/i);
  });

  it("addProfile throws on reserved name 'default'", () => {
    expect(() =>
      addProfile(
        { name: "default", serverUrl: "http://x", apiKey: "" },
        dir,
      ),
    ).toThrow(/reserved/);
  });

  it("addProfile throws on name exceeding 32 chars", () => {
    expect(() =>
      addProfile(
        { name: "a".repeat(33), serverUrl: "http://x", apiKey: "" },
        dir,
      ),
    ).toThrow(/32 characters/);
  });

  it("removeProfile deletes the profile file", () => {
    addProfile(
      { name: "local", serverUrl: "http://localhost:3000", apiKey: "pa_dev" },
      dir,
    );
    addProfile(
      { name: "other", serverUrl: "http://other:3000", apiKey: "" },
      dir,
    );
    useProfile("other", dir);
    removeProfile("local", dir);
    expect(listProfiles(dir)).toEqual([
      { name: "other", serverUrl: "http://other:3000", apiKey: "" },
    ]);
  });

  it("removeProfile throws when profile does not exist", () => {
    expect(() => removeProfile("nonexistent", dir)).toThrow(/not found/);
  });

  it("removeProfile throws when removing the active profile", () => {
    addProfile(
      { name: "local", serverUrl: "http://localhost:3000", apiKey: "" },
      dir,
    );
    addProfile(
      { name: "prod", serverUrl: "https://pa.io", apiKey: "pa_key" },
      dir,
    );
    useProfile("local", dir);
    expect(() => removeProfile("local", dir)).toThrow(
      /Cannot remove.*currently active/i,
    );
  });

  it("useProfile updates currentProfile in config.json", () => {
    addProfile(
      { name: "local", serverUrl: "http://localhost:3000", apiKey: "" },
      dir,
    );
    addProfile(
      { name: "prod", serverUrl: "https://pa.io", apiKey: "pa_key" },
      dir,
    );
    const result = useProfile("prod", dir);
    expect(result.serverUrl).toBe("https://pa.io");
    expect(getCurrentProfileName(dir)).toBe("prod");
  });

  it("useProfile throws when profile does not exist", () => {
    expect(() => useProfile("nonexistent", dir)).toThrow(/not found/);
  });

  it("getCurrentProfileName returns null when no config.json exists", () => {
    expect(getCurrentProfileName(dir)).toBeNull();
  });
});

describe("migration from legacy config", () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("migrates legacy config.json to profiles/local.json", () => {
    // Write old-format config
    writeRootConfigDirect(
      { serverUrl: "http://legacy:3000", apiKey: "pa_old_key" },
      dir,
    );

    const config = loadConfig(dir);
    expect(config.serverUrl).toBe("http://legacy:3000");
    expect(config.apiKey).toBe("pa_old_key");

    expect(getCurrentProfileName(dir)).toBe("local");

    const profiles = listProfiles(dir);
    expect(profiles).toEqual([
      { name: "local", serverUrl: "http://legacy:3000", apiKey: "pa_old_key" },
    ]);
  });

  it("does not re-migrate if already in new format", () => {
    addProfile(
      { name: "local", serverUrl: "http://localhost:3000", apiKey: "pa_dev" },
      dir,
    );
    useProfile("local", dir);

    const before = loadConfig(dir);
    const after = loadConfig(dir);
    expect(after).toEqual(before);
  });

  it("setConfigValue works after migration", () => {
    // Write old-format config
    writeRootConfigDirect(
      { serverUrl: "http://legacy:3000", apiKey: "pa_old" },
      dir,
    );

    setConfigValue("apiKey", "pa_new", dir);

    const config = loadConfig(dir);
    expect(config.apiKey).toBe("pa_new");
  });

  it("returns defaults when no config and no profiles", () => {
    const config = loadConfig(dir);
    expect(config).toEqual({
      serverUrl: "http://localhost:3000",
      apiKey: "",
    });
  });

  it("returns defaults when currentProfile is set but file is missing", () => {
    // Write root config pointing to nonexistent profile
    writeRootConfigDirect({ currentProfile: "ghost" }, dir);

    const config = loadConfig(dir);
    expect(config).toEqual({
      serverUrl: "http://localhost:3000",
      apiKey: "",
    });
  });
});

describe("loadConfig with profiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns config from active profile", () => {
    addProfile(
      {
        name: "staging",
        serverUrl: "https://staging.example.com",
        apiKey: "pa_stg",
      },
      dir,
    );
    useProfile("staging", dir);

    const config = loadConfig(dir);
    expect(config.serverUrl).toBe("https://staging.example.com");
    expect(config.apiKey).toBe("pa_stg");
  });

  it("returns updated values after setConfigValue", () => {
    addProfile(
      {
        name: "local",
        serverUrl: "http://localhost:3000",
        apiKey: "pa_dev",
      },
      dir,
    );
    useProfile("local", dir);

    setConfigValue("serverUrl", "http://newhost:4000", dir);

    const config = loadConfig(dir);
    expect(config.serverUrl).toBe("http://newhost:4000");
  });
});

describe("setConfigValue with profiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("throws when no active profile", () => {
    expect(() => setConfigValue("serverUrl", "http://x", dir)).toThrow(
      /No active profile/,
    );
  });

  it("updates only the active profile", () => {
    addProfile(
      { name: "dev", serverUrl: "http://dev:3000", apiKey: "pa_dev" },
      dir,
    );
    addProfile(
      { name: "prod", serverUrl: "https://prod.example.com", apiKey: "pa_prod" },
      dir,
    );
    useProfile("dev", dir);

    setConfigValue("serverUrl", "http://dev-updated:3000", dir);

    const devConfig = loadConfig(dir);
    expect(devConfig.serverUrl).toBe("http://dev-updated:3000");

    // Switch to prod and verify it was NOT changed
    useProfile("prod", dir);
    const prodConfig = loadConfig(dir);
    expect(prodConfig.serverUrl).toBe("https://prod.example.com");
  });
});
