import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const postMultipartMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    postMultipart = postMultipartMock;
  },
}));

vi.mock("../../src/lib/config.js", () => ({
  loadConfig: () => ({
    serverUrl: "http://localhost:3000",
    apiKey: "pa_test123",
  }),
}));

vi.mock("ora", () => ({
  default: () => ({
    start: spinnerStartMock,
  }),
}));

async function runExampleImport(argv: string[]) {
  const { registerExampleCommands } = await import("../../src/commands/example/index.js");
  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");
  registerExampleCommands(program);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("example import command", () => {
  beforeEach(() => {
    postMultipartMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("uploads a zip bundle with flags", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-example-import-test-"));
    const zipPath = path.join(tempDir, "bundle.zip");
    fs.writeFileSync(zipPath, Buffer.from("zip-content"));

    postMultipartMock.mockResolvedValueOnce({
      ok: true,
      example: {
        id: "example_1",
        title: "Demo Bundle",
        counts: { files: 1, artifacts: 2, liveArtifacts: 3 },
      },
      space: {
        id: "space_1",
        key: "default",
      },
    });

    await runExampleImport([
      "example",
      "import",
      zipPath,
      "--space",
      "default",
      "--force",
      "--require-agent-match",
    ]);

    expect(postMultipartMock).toHaveBeenCalledTimes(1);
    expect(postMultipartMock).toHaveBeenCalledWith("/api/examples/import", expect.any(FormData));

    const form = postMultipartMock.mock.calls[0][1] as FormData;
    expect(form.get("spaceKey")).toBe("default");
    expect(form.get("force")).toBe("true");
    expect(form.get("requireAgentMatch")).toBe("true");
    expect(form.get("bundle")).toBeInstanceOf(File);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

