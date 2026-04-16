import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadConfig, saveConfig, maskApiKey } from "../../src/lib/config.js";

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-test-"));

describe("loadConfig / saveConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns defaults when config file does not exist", () => {
    const config = loadConfig(dir);
    expect(config.serverUrl).toBe("http://localhost:3000");
    expect(config.apiKey).toBe("");
  });

  it("round-trips a full config", () => {
    saveConfig({ serverUrl: "https://pa.example.com", apiKey: "pa_abc123" }, dir);
    const config = loadConfig(dir);
    expect(config.serverUrl).toBe("https://pa.example.com");
    expect(config.apiKey).toBe("pa_abc123");
  });

  it("overwrites existing config", () => {
    saveConfig({ serverUrl: "http://a", apiKey: "" }, dir);
    saveConfig({ serverUrl: "http://b", apiKey: "pa_x" }, dir);
    const config = loadConfig(dir);
    expect(config.serverUrl).toBe("http://b");
    expect(config.apiKey).toBe("pa_x");
  });
});

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
