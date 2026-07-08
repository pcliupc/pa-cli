import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const outputDataMock = vi.fn();

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
    start: () => ({ stop: vi.fn() }),
  }),
}));

async function runUsageGet(argv: string[]) {
  const { registerUsageCommands } = await import("../../src/commands/usage/index.js");

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  registerUsageCommands(program);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("usage get command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    outputDataMock.mockReset();
  });

  it("calls overview API without date filters", async () => {
    getJsonMock.mockResolvedValueOnce({
      inputTokens: "10",
      outputTokens: "5",
      totalTokens: "15",
      modelDurationMs: "100",
      searchCallCount: "2",
      activeUserCount: "1",
      activeAgentCount: "1",
      activeSessionCount: "1",
    });

    await runUsageGet(["usage", "get"]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/usage-analytics/overview");
    expect(outputDataMock).toHaveBeenCalledWith(
      {
        inputTokens: "10",
        outputTokens: "5",
        totalTokens: "15",
        modelDurationMs: "100",
        searchCallCount: "2",
        activeUserCount: "1",
        activeAgentCount: "1",
        activeSessionCount: "1",
      },
      "table",
      [
        "Input Tokens",
        "Output Tokens",
        "Total Tokens",
        "Model Duration (ms)",
        "Search Calls",
        "Active Users",
        "Active Agents",
        "Active Sessions",
      ],
      [["10", "5", "15", "100", "2", "1", "1", "1"]],
    );
  });

  it("passes date filters to overview API", async () => {
    getJsonMock.mockResolvedValueOnce({
      inputTokens: "100",
      outputTokens: "50",
      totalTokens: "150",
      modelDurationMs: "1000",
      searchCallCount: "20",
      activeUserCount: "3",
      activeAgentCount: "2",
      activeSessionCount: "4",
    });

    await runUsageGet([
      "usage",
      "get",
      "--date-from",
      "2026-07-01",
      "--date-to",
      "2026-07-07",
    ]);

    expect(getJsonMock).toHaveBeenCalledWith(
      "/api/usage-analytics/overview?dateFrom=2026-07-01&dateTo=2026-07-07",
    );
  });
});
