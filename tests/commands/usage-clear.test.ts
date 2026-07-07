import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const postJsonMock = vi.fn();
const outputDataMock = vi.fn();
const questionMock = vi.fn();
const closeMock = vi.fn();

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

vi.mock("node:readline", () => ({
  createInterface: () => ({
    question: questionMock,
    close: closeMock,
  }),
}));

async function runUsageClear(argv: string[]) {
  const { registerUsageCommands } = await import("../../src/commands/usage/index.js");

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  registerUsageCommands(program);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("usage clear command", () => {
  beforeEach(() => {
    postJsonMock.mockReset();
    outputDataMock.mockReset();
    questionMock.mockReset();
    closeMock.mockReset();
  });

  it("calls usage clear API with --force", async () => {
    postJsonMock.mockResolvedValueOnce({
      clearedAt: "2026-07-07T10:00:00.000Z",
      clearedDailyStatCount: 9,
      resetUsageCursorCount: 4,
    });

    await runUsageClear(["usage", "clear", "--force"]);

    expect(postJsonMock).toHaveBeenCalledWith("/api/admin/usage-analytics/clear");
    expect(outputDataMock).toHaveBeenCalledWith(
      {
        clearedAt: "2026-07-07T10:00:00.000Z",
        clearedDailyStatCount: 9,
        resetUsageCursorCount: 4,
      },
      "table",
      ["Cleared At", "Daily Rows Cleared", "Cursor Baselines Reset"],
      [["2026-07-07T10:00:00.000Z", "9", "4"]],
    );
  });

  it("cancels when confirmation is denied", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    questionMock.mockImplementation((_: string, callback: (answer: string) => void) => {
      callback("n");
    });

    await runUsageClear(["usage", "clear"]);

    expect(postJsonMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Cancelled.");
  });

  it("continues when confirmation is accepted", async () => {
    questionMock.mockImplementation((_: string, callback: (answer: string) => void) => {
      callback("y");
    });
    postJsonMock.mockResolvedValueOnce({
      clearedAt: "2026-07-07T10:00:00.000Z",
      clearedDailyStatCount: 2,
      resetUsageCursorCount: 1,
    });

    await runUsageClear(["usage", "clear"]);

    expect(postJsonMock).toHaveBeenCalledWith("/api/admin/usage-analytics/clear");
    expect(outputDataMock).toHaveBeenCalledWith(
      {
        clearedAt: "2026-07-07T10:00:00.000Z",
        clearedDailyStatCount: 2,
        resetUsageCursorCount: 1,
      },
      "table",
      ["Cleared At", "Daily Rows Cleared", "Cursor Baselines Reset"],
      [["2026-07-07T10:00:00.000Z", "2", "1"]],
    );
  });
});
