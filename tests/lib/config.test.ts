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
