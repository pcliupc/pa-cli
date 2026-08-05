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

  it("reports failed jobs with null result and keeps their output directory", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({ jobId: "job-failed", status: "failed", progressStage: "failed" }).mockResolvedValueOnce({ jobId: "job-failed", status: "failed", progressStage: "failed", errorKey: "insightsGenerationFailed", result: null });
    writeInsightEvaluationMock.mockResolvedValueOnce({ directory: ".pa/evaluations/job-failed", files: [".pa/evaluations/job-failed/manifest.json"] });
    await expect(run(["insights", "job", "job-failed", "--wait"])).rejects.toThrow("failed");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(".pa/evaluations/job-failed"));
  });

  it("reports failed null results as structured JSON", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({ jobId: "job-failed", status: "failed", progressStage: "failed" }).mockResolvedValueOnce({ jobId: "job-failed", status: "failed", progressStage: "failed", errorKey: "insightsGenerationFailed", result: null });
    writeInsightEvaluationMock.mockResolvedValueOnce({ directory: ".pa/evaluations/job-failed", files: [".pa/evaluations/job-failed/manifest.json"] });
    await expect(run(["--output", "json", "insights", "job", "job-failed", "--wait"])).rejects.toThrow("Resume with: pa insights job job-failed --wait");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("\"error\""));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(".pa/evaluations/job-failed"));
  });
});
