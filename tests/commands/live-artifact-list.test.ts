import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const outputDataMock = vi.fn();
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

function buildArtifact(
  id: string,
  overrides: Partial<{
    title: string;
    artifactType: string;
    packageFormat: string;
    status: string;
    currentVersion: { version: number; createdAt: string } | null;
    createdAt: string;
  }> = {},
) {
  return {
    id,
    title: overrides.title ?? `Artifact ${id}`,
    artifactType: overrides.artifactType ?? "app",
    packageFormat: overrides.packageFormat ?? "zip",
    status: overrides.status ?? "published",
    currentVersion: overrides.currentVersion ?? { version: 1, createdAt: "2026-04-22T10:00:00.000Z" },
    createdAt: overrides.createdAt ?? "2026-04-22T10:00:00.000Z",
  };
}

async function runLiveArtifactList(argv: string[]) {
  const { registerLiveArtifactListCommand } = await import(
    "../../src/commands/live-artifact/list.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  const liveArtifactCmd = program.command("live-artifact");
  registerLiveArtifactListCommand(liveArtifactCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("live-artifact list command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("fetches and displays artifacts in a table", async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [buildArtifact("la-1"), buildArtifact("la-2")],
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    await runLiveArtifactList(["live-artifact", "list"]);

    expect(getJsonMock).toHaveBeenCalledTimes(1);
    expect(getJsonMock).toHaveBeenNthCalledWith(1, "/api/live-artifacts?page=1&pageSize=50&scope=self");
    expect(outputDataMock).toHaveBeenCalledWith(
      [buildArtifact("la-1"), buildArtifact("la-2")],
      "table",
      ["ID", "Title", "Type", "Status", "Version", "Created"],
      expect.any(Array),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });

  it("auto-paginates through all pages", async () => {
    getJsonMock
      .mockResolvedValueOnce({
        items: [buildArtifact("la-1"), buildArtifact("la-2")],
        pagination: { page: 1, pageSize: 2, total: 5, totalPages: 3 },
      })
      .mockResolvedValueOnce({
        items: [buildArtifact("la-3"), buildArtifact("la-4")],
        pagination: { page: 2, pageSize: 2, total: 5, totalPages: 3 },
      })
      .mockResolvedValueOnce({
        items: [buildArtifact("la-5")],
        pagination: { page: 3, pageSize: 2, total: 5, totalPages: 3 },
      });

    await runLiveArtifactList(["live-artifact", "list"]);

    expect(getJsonMock).toHaveBeenCalledTimes(3);
    expect(getJsonMock).toHaveBeenNthCalledWith(1, "/api/live-artifacts?page=1&pageSize=50&scope=self");
    expect(getJsonMock).toHaveBeenNthCalledWith(2, "/api/live-artifacts?page=2&pageSize=2&scope=self");
    expect(getJsonMock).toHaveBeenNthCalledWith(3, "/api/live-artifacts?page=3&pageSize=2&scope=self");
    expect(outputDataMock).toHaveBeenCalledWith(
      [
        buildArtifact("la-1"),
        buildArtifact("la-2"),
        buildArtifact("la-3"),
        buildArtifact("la-4"),
        buildArtifact("la-5"),
      ],
      "table",
      ["ID", "Title", "Type", "Status", "Version", "Created"],
      expect.any(Array),
    );
  });

  it("passes filter params (space, status, scope, search)", async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [buildArtifact("la-1")],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    await runLiveArtifactList([
      "live-artifact", "list",
      "--space", "space-abc",
      "--status", "published",
      "--scope", "all",
      "--search", "my artifact",
    ]);

    const calledUrl = getJsonMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("spaceId=space-abc");
    expect(calledUrl).toContain("status=published");
    expect(calledUrl).toContain("scope=all");
    expect(calledUrl).toContain("q=my+artifact");
  });

  it("uses default scope=self when --scope is not provided", async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    await runLiveArtifactList(["live-artifact", "list"]);

    const calledUrl = getJsonMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("scope=self");
  });

  it("prints friendly message when no artifacts found", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    await runLiveArtifactList(["live-artifact", "list"]);

    expect(logSpy).toHaveBeenCalledWith("No live artifacts found.");
    expect(outputDataMock).not.toHaveBeenCalled();
  });

  it("exits with error on API failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as typeof process.exit);

    getJsonMock.mockRejectedValueOnce(new Error("network error"));

    await expect(runLiveArtifactList(["live-artifact", "list"])).rejects.toThrow("process.exit:1");
    expect(errorSpy).toHaveBeenCalledWith("Error: network error");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });
});
