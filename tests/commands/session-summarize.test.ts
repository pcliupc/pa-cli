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
  const { registerSessionCommands } = await import("../../src/commands/session/index.js");
  const program = new Command().exitOverride().option("--output <format>", "", "table").option("--server <url>", "");
  registerSessionCommands(program);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("session summarize", () => {
  beforeEach(() => { postJsonMock.mockReset(); getJsonMock.mockReset(); writeInsightEvaluationMock.mockReset(); writeInsightEvaluationMock.mockResolvedValue({ directory: ".pa/evaluations/job-1", files: [] }); });
  it("creates a local summary job and downloads it", async () => {
    postJsonMock.mockResolvedValue({ jobId: "job-1", status: "queued" });
    getJsonMock.mockResolvedValueOnce({ jobId: "job-1", status: "generated", progressStage: "completed" }).mockResolvedValueOnce({ jobId: "job-1", status: "generated", progressStage: "completed", errorKey: null, createdAt: "", startedAt: null, completedAt: null, result: { schemaVersion: 1, jobId: "job-1", targetType: "session", targetId: "session-1", outputMode: "local", components: {}, metadata: { inputBasis: {}, coverage: {}, startedAt: "", completedAt: "", durationMs: 0 } } });
    await run(["session", "summarize", "session-1"]);
    expect(postJsonMock).toHaveBeenCalledWith("/api/insight-jobs", expect.objectContaining({ targetType: "session", targetId: "session-1", insightTypes: ["summary"], outputMode: "local" }));
    expect(writeInsightEvaluationMock).toHaveBeenCalled();
  });
});
