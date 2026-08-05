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

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export async function waitForInsightJob(input: {
  client: PaApiClient;
  jobId: string;
  intervalMs?: number;
  onStatus?: (status: InsightJobStatusResponse) => void;
}): Promise<InsightJobResultResponse> {
  let delay = input.intervalMs ?? 500;
  let lastStatus: InsightJobStatus | undefined;

  while (true) {
    const status = await input.client.getJson<InsightJobStatusResponse>(
      `/api/insight-jobs/${encodeURIComponent(input.jobId)}`,
    );
    if (status.status !== lastStatus) {
      input.onStatus?.(status);
      lastStatus = status.status;
    }
    if (terminalStatuses.has(status.status)) {
      return input.client.getJson<InsightJobResultResponse>(
        `/api/insight-jobs/${encodeURIComponent(input.jobId)}/result`,
      );
    }
    if (delay > 0) await sleep(delay);
    delay = Math.min(Math.max(delay, 100) * 1.5, 5_000);
  }
}

export async function confirmUseAvailable(input: {
  coverage: InsightJobPreflightResponse;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
}): Promise<boolean> {
  const stdin = input.stdin ?? process.stdin;
  const stdout = input.stdout ?? process.stdout;
  if (!(stdin as NodeJS.ReadableStream & { isTTY?: boolean }).isTTY) return false;

  const coverage = Object.entries(input.coverage.coverage)
    .map(([type, item]) => `${type}: ${item?.included ?? 0}/${item?.usable ?? 0} usable of ${item?.total ?? 0}`)
    .join(", ");
  stdout.write(`Available Session Insight coverage (${coverage}). Continue with available samples? [y/N] `);

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
    };
    stdin.on("data", onData);
    stdin.once("end", onEnd);
  });
}

export function isSuccessfulInsightJob(status: InsightJobStatus): boolean {
  return status === "generated" || status === "persisted";
}
