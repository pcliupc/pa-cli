import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const deleteJsonMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    deleteJson = deleteJsonMock;
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

async function runLiveArtifactDelete(argv: string[]) {
  const { registerLiveArtifactDeleteCommand } = await import(
    "../../src/commands/live-artifact/delete.js"
  );

  const program = new Command();
  program.exitOverride();

  const liveArtifactCmd = program.command("live-artifact");
  registerLiveArtifactDeleteCommand(liveArtifactCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("live-artifact delete command", () => {
  beforeEach(() => {
    deleteJsonMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("deletes a live artifact with --force (skips confirmation)", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    deleteJsonMock.mockResolvedValue({ ok: true });

    await runLiveArtifactDelete([
      "live-artifact",
      "delete",
      "la-1",
      "--force",
    ]);

    expect(deleteJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-1");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Live artifact "la-1" deleted'),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });

  it("exits with error on API failure", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    deleteJsonMock.mockRejectedValue(new Error("Not found"));

    await expect(
      runLiveArtifactDelete([
        "live-artifact",
        "delete",
        "la-2",
        "--force",
      ]),
    ).rejects.toThrow("process.exit");

    expect(deleteJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-2");
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Not found"),
    );

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
