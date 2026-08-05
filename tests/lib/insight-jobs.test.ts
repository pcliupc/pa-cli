import { describe, expect, it, vi } from "vitest";

import type { PaApiClient } from "../../src/lib/api-client.js";
import {
  confirmUseAvailable,
  createInsightJob,
  waitForInsightJob,
} from "../../src/lib/insight-jobs.js";

const preflight = {
  targetType: "agent" as const,
  targetId: "agent-1",
  window: null,
  agentVersionId: null,
  coverage: { business: { total: 10, usable: 8, included: 8 } },
  requiresConfirmation: true,
};

describe("insight job helpers", () => {
  it("creates local session summary jobs by default", async () => {
    const postJson = vi.fn().mockResolvedValue({ jobId: "job-1", status: "queued" });
    const result = await createInsightJob({
      client: { postJson } as unknown as PaApiClient,
      targetType: "session",
      targetId: "session-1",
      insightTypes: ["summary"],
    });

    expect(postJson).toHaveBeenCalledWith("/api/insight-jobs", {
      targetType: "session",
      targetId: "session-1",
      insightTypes: ["summary"],
      outputMode: "local",
      triggerSource: "cli",
    });
    expect(result.jobId).toBe("job-1");
  });

  it("requires --use-available when incomplete coverage is non-interactive", async () => {
    const stdin = Object.assign(new (await import("node:stream")).PassThrough(), { isTTY: false });
    await expect(confirmUseAvailable({ coverage: preflight, stdin })).resolves.toBe(false);
  });

  it("accepts only yes from an interactive confirmation", async () => {
    const { PassThrough } = await import("node:stream");
    const stdin = Object.assign(new PassThrough(), { isTTY: true });
    const stdout = new PassThrough();
    const confirmation = confirmUseAvailable({ coverage: preflight, stdin, stdout });
    stdin.end("yes\n");
    await expect(confirmation).resolves.toBe(true);
  });

  it("pauses an interactive input again after confirmation", async () => {
    const { PassThrough } = await import("node:stream");
    const stdin = Object.assign(new PassThrough(), { isTTY: true });
    const confirmation = confirmUseAvailable({ coverage: preflight, stdin, stdout: new PassThrough() });
    stdin.write("y\n");
    await expect(confirmation).resolves.toBe(true);
    expect(stdin.isPaused()).toBe(true);
  });

  it("waits until a terminal status and retrieves its result", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({ jobId: "job-1", status: "running", progressStage: "compute" })
      .mockResolvedValueOnce({ jobId: "job-1", status: "generated", progressStage: "completed" })
      .mockResolvedValueOnce({
        jobId: "job-1",
        status: "generated",
        progressStage: "completed",
        errorKey: null,
        createdAt: "2026-08-05T00:00:00.000Z",
        startedAt: "2026-08-05T00:00:01.000Z",
        completedAt: "2026-08-05T00:00:02.000Z",
        result: { schemaVersion: 1, jobId: "job-1", targetType: "session", targetId: "session-1", outputMode: "local", components: {}, metadata: { inputBasis: {}, coverage: {}, startedAt: "", completedAt: "", durationMs: 1 } },
      });

    const result = await waitForInsightJob({
      client: { getJson } as unknown as PaApiClient,
      jobId: "job-1",
      intervalMs: 0,
    });

    expect(getJson).toHaveBeenNthCalledWith(1, "/api/insight-jobs/job-1");
    expect(getJson).toHaveBeenLastCalledWith("/api/insight-jobs/job-1/result");
    expect(result.status).toBe("generated");
  });

  it("stops immediately when its caller aborts and includes a resume command", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(waitForInsightJob({
      client: { getJson: vi.fn() } as unknown as PaApiClient,
      jobId: "job-1",
      signal: controller.signal,
    })).rejects.toThrow("pa insights job job-1 --wait");
  });

  it("times out instead of polling indefinitely", async () => {
    const getJson = vi.fn().mockResolvedValue({ jobId: "job-1", status: "queued", progressStage: null });
    await expect(waitForInsightJob({
      client: { getJson } as unknown as PaApiClient,
      jobId: "job-1",
      intervalMs: 0,
      timeoutMs: 0,
    })).rejects.toThrow(/timed out/i);
  });

  it("gives a resume command when polling fails on the network", async () => {
    await expect(waitForInsightJob({
      client: { getJson: vi.fn().mockRejectedValue(new Error("Cannot connect to server")) } as unknown as PaApiClient,
      jobId: "job-1",
    })).rejects.toThrow("Resume with: pa insights job job-1 --wait");
  });

  it("aborts a status request that is already in flight", async () => {
    const controller = new AbortController();
    const pending = new Promise<never>(() => undefined);
    const wait = waitForInsightJob({
      client: { getJson: vi.fn().mockReturnValue(pending) } as unknown as PaApiClient,
      jobId: "job-1",
      signal: controller.signal,
    });
    controller.abort();
    await expect(wait).rejects.toThrow("Stopped waiting for insight job job-1");
  }, 1_000);

  it("times out a status request that is already in flight", async () => {
    await expect(waitForInsightJob({
      client: { getJson: vi.fn().mockReturnValue(new Promise<never>(() => undefined)) } as unknown as PaApiClient,
      jobId: "job-1",
      timeoutMs: 10,
    })).rejects.toThrow(/timed out/i);
  }, 1_000);

  it("aborts a result request that is already in flight", async () => {
    const controller = new AbortController();
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({ jobId: "job-1", status: "generated", progressStage: "completed" })
      .mockReturnValueOnce(new Promise<never>(() => undefined));
    const wait = waitForInsightJob({
      client: { getJson } as unknown as PaApiClient,
      jobId: "job-1",
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(getJson).toHaveBeenCalledTimes(2));
    controller.abort();
    await expect(wait).rejects.toThrow("Stopped waiting for insight job job-1");
  }, 1_000);
});
