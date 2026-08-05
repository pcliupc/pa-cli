import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { writeInsightEvaluation } from "../../src/lib/insight-output.js";

describe("writeInsightEvaluation", () => {
  it("writes a session manifest, summary, and diagnostics", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "pa-insight-output-"));
    try {
      const output = await writeInsightEvaluation({
        rootDir,
        job: {
          jobId: "job-session",
          status: "generated",
          progressStage: "completed",
          errorKey: null,
          createdAt: "2026-08-05T00:00:00.000Z",
          startedAt: "2026-08-05T00:00:01.000Z",
          completedAt: "2026-08-05T00:00:02.000Z",
          result: {
            schemaVersion: 1,
            jobId: "job-session",
            targetType: "session",
            targetId: "session-1",
            outputMode: "local",
            components: {
              summary: {
                status: "generated",
                model: "model-1",
                promptHash: "hash-1",
                generatorVersion: "v1",
                result: { summary: "A helpful summary", diagnostics: { input: "trace" } },
              },
            },
            metadata: { inputBasis: { messages: 3 }, coverage: {}, startedAt: "", completedAt: "", durationMs: 1 },
          },
        },
      });

      expect(output.directory).toBe(path.join(rootDir, "job-session"));
      await expect(readFile(path.join(output.directory, "summary.md"), "utf8")).resolves.toContain("A helpful summary");
      await expect(readFile(path.join(output.directory, "diagnostics", "summary.md"), "utf8")).resolves.toContain("trace");
      await expect(readFile(path.join(output.directory, "manifest.json"), "utf8")).resolves.toContain("job-session");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("writes business and design agent insights", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "pa-insight-output-"));
    try {
      const output = await writeInsightEvaluation({
        rootDir,
        job: {
          jobId: "job-agent",
          status: "persisted",
          progressStage: "completed",
          errorKey: null,
          createdAt: "2026-08-05T00:00:00.000Z",
          startedAt: "2026-08-05T00:00:01.000Z",
          completedAt: "2026-08-05T00:00:02.000Z",
          result: {
            schemaVersion: 1,
            jobId: "job-agent",
            targetType: "agent",
            targetId: "agent-1",
            outputMode: "persist",
            components: {
              business: { status: "persisted", model: "model-1", promptHash: null, generatorVersion: "v1", result: { overview: "Business insight" } },
              design: { status: "persisted", model: "model-1", promptHash: null, generatorVersion: "v1", result: { overview: "Design insight" } },
            },
            metadata: { inputBasis: {}, coverage: {}, startedAt: "", completedAt: "", durationMs: 1 },
          },
        },
      });

      await expect(readFile(path.join(output.directory, "business", "insights.md"), "utf8")).resolves.toContain("Business insight");
      await expect(readFile(path.join(output.directory, "design", "insights.md"), "utf8")).resolves.toContain("Design insight");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("writes a manifest even when a failed job has no result payload", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "pa-insight-output-"));
    try {
      const output = await writeInsightEvaluation({
        rootDir,
        job: {
          jobId: "job-failed",
          status: "failed",
          progressStage: "failed",
          errorKey: "insightsGenerationFailed",
          createdAt: "2026-08-05T00:00:00.000Z",
          startedAt: "2026-08-05T00:00:01.000Z",
          completedAt: "2026-08-05T00:00:02.000Z",
          result: null,
        },
      });

      expect(output.directory).toBe(path.join(rootDir, "job-failed"));
      expect(output.files).toContain(path.join(output.directory, "manifest.json"));
      await expect(readFile(path.join(output.directory, "manifest.json"), "utf8")).resolves.toContain("insightsGenerationFailed");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
