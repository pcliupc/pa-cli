import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const postJsonMock = vi.fn();
const patchJsonMock = vi.fn();
const deleteJsonMock = vi.fn();
const outputDataMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

const tempDirs: string[] = [];

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    getJson = getJsonMock;
    postJson = postJsonMock;
    patchJson = patchJsonMock;
    deleteJson = deleteJsonMock;
  },
}));

vi.mock("../../src/lib/config.js", () => ({
  loadConfig: () => ({
    serverUrl: "http://localhost:3000",
    apiKey: "pa_test123",
  }),
}));

vi.mock("../../src/lib/output.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/output.js")>(
    "../../src/lib/output.js",
  );
  return {
    ...actual,
    outputData: outputDataMock,
  };
});

vi.mock("ora", () => ({
  default: () => ({
    start: spinnerStartMock,
  }),
}));

function createTempJsonFile(payload: Record<string, unknown>): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-ai-config-test-"));
  tempDirs.push(tempDir);
  const filePath = path.join(tempDir, "config.json");
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  return filePath;
}

async function runAiConfig(argv: string[]) {
  const { registerAiConfigCommands } = await import(
    "../../src/commands/ai/config.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  const aiCmd = program.command("ai");
  registerAiConfigCommands(aiCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("ai config command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    postJsonMock.mockReset();
    patchJsonMock.mockReset();
    deleteJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("gets ai config and prints table output", async () => {
    getJsonMock.mockResolvedValue({
      stored: {
        id: "cfg-1",
        provider: "qwen",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        fastModel: "qwen3.6-plus",
        strongModel: "qwen-max",
        pricingConfig: {},
        enabled: true,
        hasApiKey: true,
        keyHint: "sk-a…",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
      },
      effective: {
        provider: "qwen",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        fastModel: "qwen3.6-plus",
        strongModel: "qwen-max",
        pricingConfig: {},
        source: "db",
        keyHint: "sk-a…",
      },
    });

    await runAiConfig(["ai", "config", "get"]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/admin/ai-provider-config");
    expect(outputDataMock).toHaveBeenCalledWith(
      expect.objectContaining({ effective: expect.objectContaining({ source: "db" }) }),
      "table",
      expect.any(Array),
      expect.arrayContaining([
        expect.arrayContaining(["stored", "qwen"]),
        expect.arrayContaining(["effective", "qwen"]),
      ]),
    );
  });

  it("creates ai config via POST with --file", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const filePath = createTempJsonFile({
      provider: "qwen",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      fastModel: "qwen3.6-plus",
      strongModel: "qwen-max",
      enabled: true,
      apiKey: "sk-test",
      pricingConfig: {},
    });

    postJsonMock.mockResolvedValue({
      stored: {
        provider: "qwen",
        strongModel: "qwen-max",
      },
      effective: {
        provider: "qwen",
        strongModel: "qwen-max",
      },
    });

    await runAiConfig(["ai", "config", "add", "--file", filePath]);

    expect(postJsonMock).toHaveBeenCalledWith(
      "/api/admin/ai-provider-config",
      expect.objectContaining({
        provider: "qwen",
        apiKey: "sk-test",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("AI config created"));
  });

  it("fails add when apiKey is missing in JSON file", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit(1)");
    });

    const filePath = createTempJsonFile({
      provider: "qwen",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      fastModel: "qwen3.6-plus",
      strongModel: "qwen-max",
      enabled: true,
      pricingConfig: {},
    });

    try {
      await runAiConfig(["ai", "config", "add", "--file", filePath]);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect((error as Error).message).toBe("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("requires a non-empty apiKey"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(postJsonMock).not.toHaveBeenCalled();
    }

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("updates ai config via PATCH with --file", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const filePath = createTempJsonFile({
      provider: "glm",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      fastModel: "glm-4.5-air",
      strongModel: "glm-4.5",
      enabled: true,
      pricingConfig: {},
    });

    patchJsonMock.mockResolvedValue({
      stored: {
        provider: "glm",
        strongModel: "glm-4.5",
      },
      effective: {
        provider: "glm",
        strongModel: "glm-4.5",
      },
    });

    await runAiConfig(["ai", "config", "update", "--file", filePath]);

    expect(patchJsonMock).toHaveBeenCalledWith(
      "/api/admin/ai-provider-config",
      expect.objectContaining({
        provider: "glm",
        strongModel: "glm-4.5",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("AI config updated"));
  });

  it("deletes ai config with --force and shows env fallback", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    deleteJsonMock.mockResolvedValue({
      stored: null,
      effective: {
        source: "env",
      },
      deletedCount: 1,
    });

    await runAiConfig(["ai", "config", "delete", "--force"]);

    expect(deleteJsonMock).toHaveBeenCalledWith("/api/admin/ai-provider-config");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("falls back to .env"));
  });

  it("writes template file for selected provider", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-ai-template-"));
    tempDirs.push(tempDir);
    const outputPath = path.join(tempDir, "glm-template.json");

    await runAiConfig([
      "ai",
      "config",
      "template",
      "--provider",
      "glm",
      "-o",
      outputPath,
    ]);

    const saved = fs.readFileSync(outputPath, "utf-8");
    expect(saved).toContain('"provider": "glm"');
    expect(saved).toContain('"fastModel": "glm-4.5-air"');
  });
});
