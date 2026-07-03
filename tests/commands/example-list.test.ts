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

async function runExampleList(argv: string[]) {
  const { registerExampleCommands } = await import("../../src/commands/example/index.js");
  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");
  registerExampleCommands(program);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("example list command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("loads and renders example rows", async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [
        {
          id: "example_1",
          title: "Demo",
          sourceSessionId: "sess_1",
          updatedAt: "2026-07-03T09:01:02.000Z",
          assetCounts: { files: 2, artifacts: 1, "live-artifacts": 3 },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    await runExampleList(["example", "list", "--space", "default", "--search", "demo"]);

    expect(getJsonMock).toHaveBeenCalledTimes(1);
    expect(getJsonMock).toHaveBeenCalledWith(
      "/api/examples?page=1&pageSize=50&spaceKey=default&q=demo",
    );
    expect(outputDataMock).toHaveBeenCalledWith(
      expect.any(Array),
      "table",
      ["ID", "Title", "Session", "Files", "Artifacts", "Live", "Updated"],
      expect.any(Array),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });
});

