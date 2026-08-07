import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const postJsonMock = vi.fn();
const getJsonMock = vi.fn();
const writeInsightEvaluationMock = vi.fn();
vi.mock("../../src/lib/api-client.js", () => ({ PaApiClient: class { postJson = postJsonMock; getJson = getJsonMock; } }));
vi.mock("../../src/lib/config.js", () => ({ loadConfig: () => ({ serverUrl: "http://localhost:3000", apiKey: "pa_test" }) }));
vi.mock("../../src/lib/insight-output.js", () => ({
  defaultInsightOutputRoot: () => ".pa/evaluations",
  writeInsightEvaluation: writeInsightEvaluationMock,
}));
vi.mock("ora", () => ({ default: () => ({ start: () => ({ stop: vi.fn() }) }) }));

async function run(argv: string[]) {
  const { registerAgentCommands } = await import("../../src/commands/agent/index.js");
  const program = new Command().exitOverride().option("--output <format>", "", "table").option("--server <url>", "");
  registerAgentCommands(program);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("agent insights", () => {
  beforeEach(() => { postJsonMock.mockReset(); getJsonMock.mockReset(); writeInsightEvaluationMock.mockReset(); writeInsightEvaluationMock.mockResolvedValue({ directory: ".pa/evaluations/job-1", files: [] }); });
  it("requires --use-available for non-TTY incomplete coverage", async () => {
    postJsonMock.mockResolvedValue({ targetType: "agent", targetId: "agent-1", window: null, agentVersionId: null, coverage: { business: { total: 2, usable: 1, included: 1 } }, requiresConfirmation: true });
    await expect(run(["agent", "insights", "agent-1"])).rejects.toThrow("--use-available");
  });
  it("passes business type and persist mode to the job API", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    postJsonMock.mockResolvedValueOnce({ targetType: "agent", targetId: "agent-1", window: null, agentVersionId: null, coverage: {}, requiresConfirmation: false }).mockResolvedValueOnce({ jobId: "job-1", status: "queued" });
    getJsonMock.mockResolvedValueOnce({ jobId: "job-1", status: "persisted", progressStage: "completed" }).mockResolvedValueOnce({ jobId: "job-1", status: "persisted", progressStage: "completed", errorKey: null, createdAt: "", startedAt: null, completedAt: null, result: { schemaVersion: 1, jobId: "job-1", targetType: "agent", targetId: "agent-1", outputMode: "persist", components: {}, metadata: { inputBasis: {}, coverage: {}, startedAt: "", completedAt: "", durationMs: 0 } } });
    await run(["agent", "insights", "agent-1", "--type", "business", "--persist"]);
    expect(postJsonMock).toHaveBeenNthCalledWith(1, "/api/insight-jobs/preflight", expect.objectContaining({ insightTypes: ["business"] }));
    expect(postJsonMock).toHaveBeenNthCalledWith(2, "/api/insight-jobs", expect.objectContaining({ outputMode: "persist", insightTypes: ["business"] }));
    expect(getJsonMock).toHaveBeenNthCalledWith(1, "/api/insight-jobs/job-1");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("completed with status persisted"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(".pa/evaluations/job-1"));
  });

  it("does not resolve an Agent version for business insights", async () => {
    postJsonMock.mockResolvedValueOnce({ targetType: "agent", targetId: "agent-1", window: null, agentVersionId: null, coverage: { business: { total: 1, usable: 1, included: 1 } }, requiresConfirmation: false }).mockResolvedValueOnce({ jobId: "job-current", status: "queued" });
    getJsonMock
      .mockResolvedValueOnce({ jobId: "job-current", status: "generated", progressStage: "completed" })
      .mockResolvedValueOnce({
        jobId: "job-current",
        status: "generated",
        progressStage: "completed",
        errorKey: null,
        result: {
          schemaVersion: 1,
          jobId: "job-current",
          targetType: "agent",
          targetId: "agent-1",
          outputMode: "local",
          components: {},
          metadata: { inputBasis: {}, coverage: {}, startedAt: "", completedAt: "", durationMs: 0 },
        },
      });
    await run(["agent", "insights", "agent-1"]);
    expect(getJsonMock).not.toHaveBeenCalledWith("/api/agents/agent-1/versions");
    expect(postJsonMock).toHaveBeenNthCalledWith(1, "/api/insight-jobs/preflight", expect.objectContaining({ insightTypes: ["business"] }));
    expect(postJsonMock).toHaveBeenNthCalledWith(2, "/api/insight-jobs", expect.objectContaining({ insightTypes: ["business"] }));
  });
  it("shows coverage when --use-available bypasses confirmation", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    postJsonMock.mockResolvedValueOnce({ targetType: "agent", targetId: "agent-1", window: null, agentVersionId: null, coverage: { business: { total: 3, usable: 2, included: 2 } }, requiresConfirmation: true }).mockResolvedValueOnce({ jobId: "job-1", status: "queued" });
    getJsonMock.mockResolvedValueOnce({ jobId: "job-1", status: "generated", progressStage: "completed" }).mockResolvedValueOnce({ jobId: "job-1", status: "generated", progressStage: "completed", errorKey: null, createdAt: "", startedAt: null, completedAt: null, result: { schemaVersion: 1, jobId: "job-1", targetType: "agent", targetId: "agent-1", outputMode: "local", components: {}, metadata: { inputBasis: {}, coverage: {}, startedAt: "", completedAt: "", durationMs: 0 } } });
    await run(["agent", "insights", "agent-1", "--use-available"]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Coverage: business 2/2 usable of 3"));
  });

  it("does not print a success message for partial output", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    postJsonMock.mockResolvedValueOnce({ targetType: "agent", targetId: "agent-1", window: null, agentVersionId: null, coverage: {}, requiresConfirmation: false }).mockResolvedValueOnce({ jobId: "job-1", status: "queued" });
    getJsonMock.mockResolvedValueOnce({ jobId: "job-1", status: "partial", progressStage: "completed" }).mockResolvedValueOnce({ jobId: "job-1", status: "partial", progressStage: "completed", errorKey: null, createdAt: "", startedAt: null, completedAt: null, result: { schemaVersion: 1, jobId: "job-1", targetType: "agent", targetId: "agent-1", outputMode: "local", components: {}, metadata: { inputBasis: {}, coverage: {}, startedAt: "", completedAt: "", durationMs: 0 } } });
    await expect(run(["agent", "insights", "agent-1"])).rejects.toThrow("partial");
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("Agent insights saved"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("finished with status partial"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(".pa/evaluations/job-1"));
  });

  it("reports a failed job with null result and keeps its output directory", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    postJsonMock.mockResolvedValueOnce({ targetType: "agent", targetId: "agent-1", window: null, agentVersionId: null, coverage: {}, requiresConfirmation: false }).mockResolvedValueOnce({ jobId: "job-failed", status: "queued" });
    getJsonMock.mockResolvedValueOnce({ jobId: "job-failed", status: "failed", progressStage: "failed" }).mockResolvedValueOnce({ jobId: "job-failed", status: "failed", progressStage: "failed", errorKey: "insightsGenerationFailed", result: null });
    writeInsightEvaluationMock.mockResolvedValueOnce({ directory: ".pa/evaluations/job-failed", files: [".pa/evaluations/job-failed/manifest.json"] });
    await expect(run(["agent", "insights", "agent-1"])).rejects.toThrow("failed");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(".pa/evaluations/job-failed"));
  });

  it("rejects standalone design generation after it was merged into business insights", async () => {
    await expect(run(["agent", "insights", "agent-1", "--type", "design"])).rejects.toThrow(
      "insightsDesignMergedIntoBusiness",
    );
    expect(postJsonMock).not.toHaveBeenCalled();
  });
});
