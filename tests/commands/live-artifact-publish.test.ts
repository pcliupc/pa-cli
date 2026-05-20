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

async function runLiveArtifactPublish(argv: string[]) {
  const { registerLiveArtifactPublishCommand } = await import(
    "../../src/commands/live-artifact/publish.js"
  );

  const program = new Command();
  program.exitOverride();

  const liveArtifactCmd = program.command("live-artifact");
  registerLiveArtifactPublishCommand(liveArtifactCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("live-artifact publish command", () => {
  beforeEach(() => {
    postJsonMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("publishes a live artifact from session workspace", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    postJsonMock.mockResolvedValue({
      artifact: {
        id: "la-1",
        title: "My App",
        artifactType: "web-app",
        status: "published",
        version: 1,
      },
    });

    await runLiveArtifactPublish([
      "live-artifact",
      "publish",
      "--session",
      "sess-1",
      "--dir",
      "./dist",
    ]);

    expect(postJsonMock).toHaveBeenCalledWith("/api/live-artifacts/publish", {
      sessionId: "sess-1",
      bundleDir: "./dist",
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Live artifact "la-1" published'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("type: web-app"),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("version: 1"),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });

  it("passes title option to the API", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    postJsonMock.mockResolvedValue({
      artifact: {
        id: "la-2",
        title: "Custom Title",
        artifactType: "dashboard",
        status: "published",
        version: 1,
      },
    });

    await runLiveArtifactPublish([
      "live-artifact",
      "publish",
      "--session",
      "sess-2",
      "--dir",
      "./build",
      "--title",
      "Custom Title",
    ]);

    expect(postJsonMock).toHaveBeenCalledWith("/api/live-artifacts/publish", {
      sessionId: "sess-2",
      bundleDir: "./build",
      title: "Custom Title",
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Live artifact "la-2" published'),
    );
  });

  it("exits with error when --session is missing", async () => {
    try {
      await runLiveArtifactPublish([
        "live-artifact",
        "publish",
        "--dir",
        "./dist",
      ]);
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      expect((err as Error).message).toContain("--session");
    }
  });

  it("exits with error when --dir is missing", async () => {
    try {
      await runLiveArtifactPublish([
        "live-artifact",
        "publish",
        "--session",
        "sess-1",
      ]);
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      expect((err as Error).message).toContain("--dir");
    }
  });
});
