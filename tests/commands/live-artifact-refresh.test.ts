import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const postJsonMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    postJson = postJsonMock;
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

async function runLiveArtifactRefresh(argv: string[]) {
  const { registerLiveArtifactRefreshCommand } = await import(
    "../../src/commands/live-artifact/refresh.js"
  );

  const program = new Command();
  program.exitOverride();

  const liveArtifactCmd = program.command("live-artifact");
  registerLiveArtifactRefreshCommand(liveArtifactCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("live-artifact refresh command", () => {
  beforeEach(() => {
    postJsonMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("refreshes a live artifact and displays result", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    postJsonMock.mockResolvedValue({
      refresh: {
        version: 2,
        reason: "source-updated",
      },
    });

    await runLiveArtifactRefresh([
      "live-artifact",
      "refresh",
      "la-1",
    ]);

    expect(postJsonMock).toHaveBeenCalledWith(
      "/api/live-artifacts/la-1/refresh",
      {},
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Live artifact "la-1" refreshed'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("version 2"),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });
});
