import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const patchJsonMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    patchJson = patchJsonMock;
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

async function runLiveArtifactUpdate(argv: string[]) {
  const { registerLiveArtifactUpdateCommand } = await import(
    "../../src/commands/live-artifact/update.js"
  );

  const program = new Command();
  program.exitOverride();

  const liveArtifactCmd = program.command("live-artifact");
  registerLiveArtifactUpdateCommand(liveArtifactCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("live-artifact update command", () => {
  beforeEach(() => {
    patchJsonMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("updates the title of a live artifact", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    patchJsonMock.mockResolvedValue({
      artifact: {
        id: "la-1",
        title: "New Title",
        status: "published",
      },
    });

    await runLiveArtifactUpdate([
      "live-artifact",
      "update",
      "la-1",
      "--title",
      "New Title",
    ]);

    expect(patchJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-1", {
      title: "New Title",
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Live artifact "la-1" updated'),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });

  it("updates the status of a live artifact", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    patchJsonMock.mockResolvedValue({
      artifact: {
        id: "la-2",
        title: "My App",
        status: "archived",
      },
    });

    await runLiveArtifactUpdate([
      "live-artifact",
      "update",
      "la-2",
      "--status",
      "archived",
    ]);

    expect(patchJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-2", {
      status: "archived",
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Live artifact "la-2" updated'),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });

  it("updates both title and status at once", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    patchJsonMock.mockResolvedValue({
      artifact: {
        id: "la-3",
        title: "Renamed App",
        status: "published",
      },
    });

    await runLiveArtifactUpdate([
      "live-artifact",
      "update",
      "la-3",
      "--title",
      "Renamed App",
      "--status",
      "published",
    ]);

    expect(patchJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-3", {
      title: "Renamed App",
      status: "published",
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Live artifact "la-3" updated'),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });

  it("exits with error when no fields specified", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit(1)");
    });

    try {
      await runLiveArtifactUpdate([
        "live-artifact",
        "update",
        "la-4",
      ]);
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      expect((err as Error).message).toBe("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("at least one of --status or --title"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    }

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
