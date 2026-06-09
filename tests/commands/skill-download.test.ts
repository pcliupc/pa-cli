import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const downloadFileMock = vi.fn();
const getJsonMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerSucceedMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    downloadFile = downloadFileMock;
    getJson = getJsonMock;
  },
}));

vi.mock("../../src/lib/config.js", () => ({
  loadConfig: () => ({
    serverUrl: "http://localhost:3000",
    apiKey: "test-key",
  }),
}));

vi.mock("ora", () => ({
  default: () => ({
    start: spinnerStartMock,
  }),
}));

async function runSkillCommand(argv: string[]) {
  const { registerSkillCommands } = await import(
    "../../src/commands/skill/index.js"
  );

  const program = new Command();
  program.exitOverride();
  registerSkillCommands(program);

  await program.parseAsync(argv, { from: "user" });
}

describe("skill download command", () => {
  beforeEach(() => {
    downloadFileMock.mockReset();
    getJsonMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerSucceedMock.mockReset();
    spinnerStartMock.mockReturnValue({ succeed: spinnerSucceedMock });
  });

  it("downloads a skill zip by name", async () => {
    getJsonMock.mockResolvedValue({
      items: [{ id: "skill-1", name: "demo-skill" }],
    });

    await runSkillCommand([
      "skill",
      "download",
      "demo-skill",
      "-o",
      "/tmp/demo-skill.zip",
    ]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/skills");
    expect(downloadFileMock).toHaveBeenCalledWith(
      "/api/skills/skill-1/download",
      "/tmp/demo-skill.zip",
    );
    expect(spinnerSucceedMock).toHaveBeenCalledWith(
      expect.stringContaining("/tmp/demo-skill.zip"),
    );
  });
});
