import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const downloadFileMock = vi.fn();
const getJsonMock = vi.fn();
const execFileSyncMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerSucceedMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

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

describe("skill install command", () => {
  beforeEach(() => {
    downloadFileMock.mockReset();
    getJsonMock.mockReset();
    execFileSyncMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerSucceedMock.mockReset();
    spinnerStartMock.mockReturnValue({ succeed: spinnerSucceedMock });
  });

  it("installs a skill into the requested directory", async () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-skill-install-"));

    getJsonMock.mockResolvedValue({
      items: [{ id: "skill-1", name: "demo-skill" }],
    });

    await runSkillCommand([
      "skill",
      "install",
      "demo-skill",
      "--dir",
      targetDir,
    ]);

    expect(downloadFileMock).toHaveBeenCalledWith(
      "/api/skills/skill-1/download",
      expect.stringMatching(/demo-skill\.zip$/),
    );
    expect(execFileSyncMock).toHaveBeenCalledWith(
      "unzip",
      [
        "-oq",
        expect.stringMatching(/demo-skill\.zip$/),
        "-d",
        path.join(targetDir, "demo-skill"),
      ],
      { stdio: "ignore" },
    );
    expect(spinnerSucceedMock).toHaveBeenCalledWith(
      expect.stringContaining(path.join(targetDir, "demo-skill")),
    );
  });
});
