import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const downloadFileMock = vi.fn();
const outputDataMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    getJson = getJsonMock;
    downloadFile = downloadFileMock;
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

async function runSessionWorkspace(argv: string[]) {
  const { registerSessionCommands } = await import(
    "../../src/commands/session/index.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  registerSessionCommands(program);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("session workspace commands", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    downloadFileMock.mockReset();
    outputDataMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("lists workspace files for a session", async () => {
    getJsonMock.mockResolvedValueOnce({
      files: [
        {
          path: "reports/summary.md",
          name: "summary.md",
          type: "text",
          size: 1024,
          modifiedAt: "2026-04-22T10:00:00.000Z",
        },
      ],
    });

    await runSessionWorkspace(["session", "workspace", "list", "sess_123"]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/workspace/sess_123/files");
    expect(outputDataMock).toHaveBeenCalledWith(
      [
        {
          path: "reports/summary.md",
          name: "summary.md",
          type: "text",
          size: 1024,
          modifiedAt: "2026-04-22T10:00:00.000Z",
        },
      ],
      "table",
      ["Path", "Type", "Size", "Modified"],
      expect.any(Array),
    );
  });

  it("prints a friendly empty state when a session workspace has no files", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({ files: [] });

    await runSessionWorkspace(["session", "workspace", "list", "sess_empty"]);

    expect(logSpy).toHaveBeenCalledWith("No workspace files found.");
    expect(outputDataMock).not.toHaveBeenCalled();
  });

  it("downloads a workspace file to the current directory by default", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runSessionWorkspace([
      "session",
      "workspace",
      "download",
      "sess_123",
      "reports/summary.md",
    ]);

    expect(downloadFileMock).toHaveBeenCalledWith(
      "/api/workspace/sess_123/serve?path=reports%2Fsummary.md",
      "summary.md",
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Saved workspace file"),
    );
  });

  it("downloads a workspace file to an explicit output path", async () => {
    await runSessionWorkspace([
      "session",
      "workspace",
      "download",
      "sess_123",
      "nested/report final.md",
      "--output",
      "./tmp/custom-report.md",
    ]);

    expect(downloadFileMock).toHaveBeenCalledWith(
      "/api/workspace/sess_123/serve?path=nested%2Freport%20final.md",
      "./tmp/custom-report.md",
    );
  });

  it("renders workspace download metadata in json mode", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runSessionWorkspace([
      "--output",
      "json",
      "session",
      "workspace",
      "download",
      "sess_123",
      "reports/summary.md",
    ]);

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          sessionId: "sess_123",
          workspacePath: "reports/summary.md",
          outputPath: "summary.md",
        },
        null,
        2,
      ),
    );
  });

  it("exits with code 1 when workspace download fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as typeof process.exit);

    downloadFileMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      runSessionWorkspace([
        "session",
        "workspace",
        "download",
        "sess_123",
        "reports/summary.md",
      ]),
    ).rejects.toThrow("process.exit:1");

    expect(errorSpy).toHaveBeenCalledWith("Error: boom");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });
});
