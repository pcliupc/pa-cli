import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PaConfig } from "./config.js";
import {
  filterServiceLogs,
  sortServiceLogsDescending,
  type LogQueryOptions,
  type ServiceLogEntry,
  type ServiceLogName,
} from "./log-query.js";

const execFileAsync = promisify(execFile);

type ExecFileLike = typeof execFileAsync;

interface SlsQueryResult {
  data?: Record<string, unknown>[];
}

function parseTimeExpression(
  value: string | undefined,
  now: number,
): number | null {
  if (!value) return null;

  const relativeMatch = /^(\d+)([smhdw])$/i.exec(value.trim());
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const unitMs =
      unit === "s"
        ? 1_000
        : unit === "m"
          ? 60_000
          : unit === "h"
            ? 3_600_000
            : unit === "d"
              ? 86_400_000
              : 604_800_000;
    return now - amount * unitMs;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSlsTimestamp(value: number): string {
  const date = new Date(value);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function normalizeTimeRange(options: LogQueryOptions): {
  fromTime: string;
  toTime: string;
} {
  const now = Date.now();
  const until = parseTimeExpression(options.until, now) ?? now;
  const since =
    parseTimeExpression(options.since, now) ?? until - 3_600_000;

  if (since > until) {
    throw new Error("since must be earlier than until");
  }

  return {
    fromTime: formatSlsTimestamp(since),
    toTime: formatSlsTimestamp(until),
  };
}

function quoteQueryValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function buildQuery(options: LogQueryOptions, service: ServiceLogName): string {
  const terms = [
    `service:${quoteQueryValue(service)}`,
    options.session ? `sessionId:${quoteQueryValue(options.session)}` : null,
    options.trace ? `traceId:${quoteQueryValue(options.trace)}` : null,
    options.request ? `requestId:${quoteQueryValue(options.request)}` : null,
    options.space ? `spaceId:${quoteQueryValue(options.space)}` : null,
    options.user ? `userId:${quoteQueryValue(options.user)}` : null,
    options.agent ? `agentId:${quoteQueryValue(options.agent)}` : null,
    options.level ? `level:${quoteQueryValue(options.level.toUpperCase())}` : null,
    options.event ? `event:${quoteQueryValue(options.event)}` : null,
  ].filter((term): term is string => Boolean(term));

  return terms.length > 0 ? terms.join(" and ") : "*";
}

function resolveLogstores(
  config: PaConfig,
  service: ServiceLogName | "all",
): Array<{ service: ServiceLogName; logstore: string }> {
  const targets =
    service === "all" ? (["web", "runtime"] as const) : [service];

  return targets.flatMap((name) => {
    const logstore =
      name === "web" ? config.slsWebLogstore : config.slsRuntimeLogstore;
    return logstore ? [{ service: name, logstore }] : [];
  });
}

function ensureSlsConfig(
  config: PaConfig,
  service: ServiceLogName | "all",
): Array<{ service: ServiceLogName; logstore: string }> {
  if (!config.slsProject) {
    throw new Error("Missing slsProject. Run 'pa config set slsProject <value>'.");
  }

  const logstores = resolveLogstores(config, service);
  if (logstores.length === 0) {
    throw new Error(
      service === "all"
        ? "Missing SLS logstore config. Set slsWebLogstore and/or slsRuntimeLogstore."
        : `Missing ${
            service === "web" ? "slsWebLogstore" : "slsRuntimeLogstore"
          }. Run 'pa config set ${
            service === "web" ? "slsWebLogstore" : "slsRuntimeLogstore"
          } <value>'.`,
    );
  }

  return logstores;
}

function normalizeSlsEntry(
  entry: Record<string, unknown>,
  service: ServiceLogName,
): ServiceLogEntry {
  const ts =
    typeof entry.ts === "string"
      ? entry.ts
      : typeof entry.__time__ === "string" || typeof entry.__time__ === "number"
        ? new Date(Number(entry.__time__) * 1000).toISOString()
        : undefined;

  return {
    ...entry,
    ts,
    service:
      entry.service === "web" || entry.service === "runtime"
        ? entry.service
        : service,
    level: typeof entry.level === "string" ? entry.level : undefined,
    tenantId: typeof entry.tenantId === "string" ? entry.tenantId : undefined,
    event: typeof entry.event === "string" ? entry.event : undefined,
    message: typeof entry.message === "string" ? entry.message : undefined,
    traceId: typeof entry.traceId === "string" ? entry.traceId : undefined,
    requestId:
      typeof entry.requestId === "string" ? entry.requestId : undefined,
    sessionId:
      typeof entry.sessionId === "string" ? entry.sessionId : null,
    spaceId: typeof entry.spaceId === "string" ? entry.spaceId : null,
    userId: typeof entry.userId === "string" ? entry.userId : null,
    agentId: typeof entry.agentId === "string" ? entry.agentId : null,
  };
}

async function runSlsRequest(
  project: string,
  logstore: string,
  service: ServiceLogName,
  options: LogQueryOptions,
  config: PaConfig,
  run: ExecFileLike,
): Promise<ServiceLogEntry[]> {
  const { fromTime, toTime } = normalizeTimeRange(options);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-sls-query-"));
  const requestPath = path.join(tempDir, "request.json");

  const requestBody = {
    project,
    logstore,
    fromTime,
    toTime,
    query: buildQuery(options, service),
    line: String(options.limit),
    offset: "0",
    reverse: true,
  };

  fs.writeFileSync(requestPath, JSON.stringify(requestBody), "utf8");

  const args = [
    "log",
    "get_logs",
    "--request",
    `file://${requestPath}`,
    "--format-output",
    "json",
    ...(config.aliyunProfile ? ["--profile", config.aliyunProfile] : []),
  ];

  try {
    const { stdout } = await run("aliyunlog", args);
    const parsed = JSON.parse(stdout) as SlsQueryResult | Record<string, unknown>[];
    const rows = Array.isArray(parsed) ? parsed : parsed.data ?? [];
    return rows.map((entry) => normalizeSlsEntry(entry, service));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function hasSlsLogSource(
  config: PaConfig,
  service: ServiceLogName | "all",
): boolean {
  if (!config.slsProject) return false;
  return resolveLogstores(config, service).length > 0;
}

export async function querySlsLogs(
  options: LogQueryOptions,
  config: PaConfig,
  run: ExecFileLike = execFileAsync,
): Promise<ServiceLogEntry[]> {
  const logstores = ensureSlsConfig(config, options.service);
  const results = await Promise.all(
    logstores.map(({ service, logstore }) =>
      runSlsRequest(config.slsProject!, logstore, service, options, config, run),
    ),
  );

  return sortServiceLogsDescending(
    filterServiceLogs(results.flat(), options),
  ).slice(0, options.limit);
}
