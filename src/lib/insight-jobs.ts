import type { PaApiClient } from "./api-client.js";

export type InsightJobType = "summary" | "business" | "design";
export type InsightJobOutputMode = "local" | "persist";
export type InsightJobStatus =
  | "queued"
  | "running"
  | "generated"
  | "persisted"
  | "partial"
  | "failed"
  | "expired";

export interface InsightCoverageItem {
  total: number;
  usable: number;
  included: number;
  truncatedReason?: "sample_limit" | "input_budget";
}

export interface InsightJobPreflightResponse {
  targetType: "session" | "agent";
  targetId: string;
  window: { from: string; to: string } | null;
  agentVersionId: string | null;
  coverage: {
    business?: InsightCoverageItem;
    design?: InsightCoverageItem;
  };
  requiresConfirmation: boolean;
}

export interface InsightJobStatusResponse {
  jobId: string;
  status: InsightJobStatus;
  progressStage: string | null;
  errorKey?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface InsightJobResultResponse extends InsightJobStatusResponse {
  result: InsightJobResult | null;
}

export interface InsightJobResult {
  schemaVersion: 1;
  jobId: string;
  targetType: "session" | "agent";
  targetId: string;
  outputMode: InsightJobOutputMode;
  components: Record<string, InsightJobComponent | undefined>;
  metadata: {
    inputBasis: Record<string, unknown>;
    coverage: Record<string, InsightCoverageItem | undefined>;
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

export interface InsightJobComponent {
  status: "generated" | "persisted" | "failed";
  result?: Record<string, unknown>;
  errorKey?: string;
  model: string | null;
  promptHash: string | null;
  generatorVersion: string;
}

interface CreateInsightJobResponse {
  jobId: string;
  status: InsightJobStatus;
  pollUrl?: string;
  reused?: boolean;
}

export async function preflightInsightJob(input: {
  client: PaApiClient;
  targetType: "session" | "agent";
  targetId: string;
  insightTypes: InsightJobType[];
  agentVersionId?: string;
}): Promise<InsightJobPreflightResponse> {
  return input.client.postJson<InsightJobPreflightResponse>("/api/insight-jobs/preflight", {
    targetType: input.targetType,
    targetId: input.targetId,
    insightTypes: input.insightTypes,
    outputMode: "local",
    triggerSource: "cli",
    ...(input.agentVersionId ? { agentVersionId: input.agentVersionId } : {}),
  });
}

export async function createInsightJob(input: {
  client: PaApiClient;
  targetType: "session" | "agent";
  targetId: string;
  insightTypes: InsightJobType[];
  outputMode?: InsightJobOutputMode;
  agentVersionId?: string;
  useAvailable?: boolean;
}): Promise<CreateInsightJobResponse> {
  return input.client.postJson<CreateInsightJobResponse>("/api/insight-jobs", {
    targetType: input.targetType,
    targetId: input.targetId,
    insightTypes: input.insightTypes,
    outputMode: input.outputMode ?? "local",
    triggerSource: "cli",
    ...(input.agentVersionId ? { agentVersionId: input.agentVersionId } : {}),
    ...(input.useAvailable ? { useAvailable: true } : {}),
  });
}

const terminalStatuses = new Set<InsightJobStatus>([
  "generated",
  "persisted",
  "partial",
  "failed",
  "expired",
]);

export class InsightJobWaitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsightJobWaitError";
  }
}

function resumeHint(jobId: string): string {
  return `Resume with: pa insights job ${jobId} --wait`;
}

function abortError(jobId: string): InsightJobWaitError {
  return new InsightJobWaitError(`Stopped waiting for insight job ${jobId}. ${resumeHint(jobId)}`);
}

function timeoutError(jobId: string): InsightJobWaitError {
  return new InsightJobWaitError(`Timed out waiting for insight job ${jobId}. ${resumeHint(jobId)}`);
}

function pollError(jobId: string, error: unknown): InsightJobWaitError {
  const message = error instanceof Error ? error.message : String(error);
  return new InsightJobWaitError(`Unable to poll insight job ${jobId}: ${message}. ${resumeHint(jobId)}`);
}

async function awaitControlledRequest<T>(input: {
  request: () => Promise<T>;
  jobId: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<T> {
  if (input.signal?.aborted) throw abortError(input.jobId);
  if (input.timeoutMs <= 0) throw timeoutError(input.jobId);

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = () => settle(() => reject(abortError(input.jobId)));
    const timer = setTimeout(
      () => settle(() => reject(timeoutError(input.jobId))),
      input.timeoutMs,
    );

    input.signal?.addEventListener("abort", onAbort, { once: true });
    Promise.resolve()
      .then(input.request)
      .then(
        (value) => settle(() => resolve(value)),
        (error: unknown) => settle(() => reject(error)),
      );
  });
}

function sleep(durationMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new Error("aborted"));
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout;
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const cleanupAndResolve = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("aborted"));
    };
    timer = setTimeout(cleanupAndResolve, durationMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function waitForInsightJob(input: {
  client: PaApiClient;
  jobId: string;
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onStatus?: (status: InsightJobStatusResponse) => void;
}): Promise<InsightJobResultResponse> {
  let delay = input.intervalMs ?? 500;
  let lastStatus: InsightJobStatus | undefined;
  const startedAt = Date.now();
  const timeoutMs = input.timeoutMs ?? 15 * 60 * 1_000;

  while (true) {
    if (input.signal?.aborted) throw abortError(input.jobId);
    if (Date.now() - startedAt >= timeoutMs) throw timeoutError(input.jobId);
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    let status: InsightJobStatusResponse;
    try {
      status = await awaitControlledRequest({
        request: () => input.client.getJson<InsightJobStatusResponse>(
          `/api/insight-jobs/${encodeURIComponent(input.jobId)}`,
        ),
        jobId: input.jobId,
        signal: input.signal,
        timeoutMs: remainingMs,
      });
    } catch (error) {
      if (error instanceof InsightJobWaitError) throw error;
      if (input.signal?.aborted) throw abortError(input.jobId);
      throw pollError(input.jobId, error);
    }
    if (status.status !== lastStatus) {
      input.onStatus?.(status);
      lastStatus = status.status;
    }
    if (terminalStatuses.has(status.status)) {
      try {
        return await awaitControlledRequest({
          request: () => input.client.getJson<InsightJobResultResponse>(
            `/api/insight-jobs/${encodeURIComponent(input.jobId)}/result`,
          ),
          jobId: input.jobId,
          signal: input.signal,
          timeoutMs: timeoutMs - (Date.now() - startedAt),
        });
      } catch (error) {
        if (error instanceof InsightJobWaitError) throw error;
        if (error instanceof Error && /expired/i.test(error.message)) throw error;
        throw pollError(input.jobId, error);
      }
    }
    try {
      if (delay > 0) await sleep(delay, input.signal);
    } catch {
      throw abortError(input.jobId);
    }
    delay = Math.min(Math.max(delay, 100) * 1.5, 5_000);
  }
}

export function formatInsightCoverage(coverage: InsightJobPreflightResponse): string {
  const details = Object.entries(coverage.coverage)
    .map(([type, item]) => `${type} ${item?.included ?? 0}/${item?.usable ?? 0} usable of ${item?.total ?? 0}`)
    .join(", ");
  return `Coverage: ${details || "no Session Insights available"}`;
}

export function formatInsightJobOutcome(input: {
  jobId: string;
  status: InsightJobStatus;
  directory: string;
}): string {
  const verb = isSuccessfulInsightJob(input.status) ? "completed" : "finished";
  return `Insight job ${input.jobId} ${verb} with status ${input.status}. Output saved to ${input.directory}.`;
}

export async function confirmUseAvailable(input: {
  coverage: InsightJobPreflightResponse;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
}): Promise<boolean> {
  const stdin = input.stdin ?? process.stdin;
  const stdout = input.stdout ?? process.stdout;
  if (!(stdin as NodeJS.ReadableStream & { isTTY?: boolean }).isTTY) return false;

  stdout.write(`${formatInsightCoverage(input.coverage)}. Continue with available samples? [y/N] `);

  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk: Buffer | string) => {
      value += chunk.toString();
      if (!value.includes("\n") && !value.includes("\r")) return;
      cleanup();
      resolve(/^(y|yes)$/i.test(value.trim()));
    };
    const onEnd = () => {
      cleanup();
      resolve(/^(y|yes)$/i.test(value.trim()));
    };
    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.removeListener("end", onEnd);
      if ("pause" in stdin && typeof stdin.pause === "function") stdin.pause();
    };
    if ("resume" in stdin && typeof stdin.resume === "function") stdin.resume();
    stdin.on("data", onData);
    stdin.once("end", onEnd);
  });
}

export function isSuccessfulInsightJob(status: InsightJobStatus): boolean {
  return status === "generated" || status === "persisted";
}
