import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const writeInsightEvaluationMock = vi.fn();
vi.mock("../../src/lib/api-client.js", () => ({ PaApiClient: class { getJson = getJsonMock; } }));
vi.mock("../../src/lib/config.js", () => ({ loadConfig: () => ({ serverUrl: "http://localhost:3000", apiKey: "pa_test" }) }));
vi.mock("../../src/lib/insight-output.js", () => ({
  defaultInsightOutputRoot: () => ".pa/evaluations",
  writeInsightEvaluation: writeInsightEvaluationMock,
}));
vi.mock("ora", () => ({ default: () => ({ start: () => ({ stop: vi.fn() }) }) }));

async function run(argv: string[]) {
  const { registerInsightsCommands } = await import("../../src/commands/insights/index.js");
  const program = new Command().exitOverride().option("--output <format>", "", "table").option("--server <url>", "");
  registerInsightsCommands(program);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("insights job", () => {
  beforeEach(() => { getJsonMock.mockReset(); writeInsightEvaluationMock.mockReset(); });
  it("requires --wait before downloading a job result", async () => {
    await expect(run(["insights", "job", "job-1"])).rejects.toThrow("--wait");
  });

  it("keeps an expired job result error actionable", async () => {
    getJsonMock.mockRejectedValueOnce(new Error("Insight job result has expired."));
    await expect(run(["insights", "job", "job-1", "--wait"])).rejects.toThrow(
      "Insight job result has expired.",
    );
  });
});
