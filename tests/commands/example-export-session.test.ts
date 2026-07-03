import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const downloadFileMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    downloadFile = downloadFileMock;
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

async function runExampleExport(argv: string[]) {
  const { registerExampleCommands } = await import("../../src/commands/example/index.js");
  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");
  registerExampleCommands(program);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("example export-session command", () => {
  beforeEach(() => {
    downloadFileMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("downloads and extracts bundle when --as-dir is set", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-example-export-test-"));
    const outputZip = path.join(tempDir, "bundle.zip");
    const extractDir = path.join(tempDir, "bundle-dir");

    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ schemaVersion: 1 }));
    zip.file("snapshot/session.json", JSON.stringify({ id: "sess_1" }));
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    downloadFileMock.mockImplementation(async (_apiPath: string, outputPath: string) => {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, zipBuffer);
    });

    await runExampleExport([
      "example",
      "export-session",
      "sess_1",
      "-o",
      outputZip,
      "--as-dir",
      extractDir,
    ]);

    expect(downloadFileMock).toHaveBeenCalledTimes(1);
    expect(downloadFileMock).toHaveBeenCalledWith(
      "/api/examples/export-session/sess_1",
      outputZip,
    );
    expect(fs.existsSync(path.join(extractDir, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(extractDir, "snapshot", "session.json"))).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
