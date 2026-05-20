import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    getJson = getJsonMock;
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

async function runLiveArtifactGet(argv: string[]) {
  const { registerLiveArtifactGetCommand } = await import(
    "../../src/commands/live-artifact/get.js"
  );

  const program = new Command();
  program.exitOverride();

  const liveArtifactCmd = program.command("live-artifact");
  registerLiveArtifactGetCommand(liveArtifactCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("live-artifact get command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("fetches and displays live artifact details as JSON", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const artifact = {
      id: "la-1",
      title: "Test Artifact",
      artifactType: "web-app",
      packageFormat: "zip",
      runtimeTarget: "browser",
      runtimeMode: "static",
      status: "published",
      visibility: "public",
      currentVersion: {
        id: "v-1",
        version: 3,
        createdAt: "2026-05-19T10:00:00Z",
        bundlePath: "/bundles/la-1/v3.zip",
      },
      sourceDocuments: [],
      canWrite: true,
    };

    getJsonMock.mockResolvedValue({ artifact });

    await runLiveArtifactGet(["live-artifact", "get", "la-1"]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-1");
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(artifact, null, 2),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });

  it("exits with error when artifact not found", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    getJsonMock.mockRejectedValue(new Error("Resource not found."));

    await expect(
      runLiveArtifactGet(["live-artifact", "get", "nonexistent"]),
    ).rejects.toThrow("process.exit");

    expect(getJsonMock).toHaveBeenCalledWith(
      "/api/live-artifacts/nonexistent",
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Resource not found."),
    );

    exitSpy.mockRestore();
  });
});
