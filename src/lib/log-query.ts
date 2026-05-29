export type ServiceLogName = "web" | "runtime";
export type ServiceLogScope = ServiceLogName | "all";
export type LogSource = "auto" | "local" | "sls";

export interface ServiceLogEntry {
  ts?: string;
  level?: string;
  service?: ServiceLogName;
  tenantId?: string;
  event?: string;
  message?: string;
  traceId?: string;
  requestId?: string;
  sessionId?: string | null;
  spaceId?: string | null;
  userId?: string | null;
  agentId?: string | null;
  [key: string]: unknown;
}

export interface LogQueryOptions {
  source: LogSource;
  service: ServiceLogScope;
  since: string;
  until?: string;
  session?: string;
  trace?: string;
  request?: string;
  space?: string;
  user?: string;
  agent?: string;
  level?: string;
  event?: string;
  grep?: string;
  limit: number;
}

export function parseServiceLogLine(line: string): ServiceLogEntry {
  const parsed = JSON.parse(line) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid service log entry");
  }
  return parsed as ServiceLogEntry;
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

function getEntryTimestamp(entry: ServiceLogEntry): number | null {
  if (typeof entry.ts !== "string" || !entry.ts) return null;
  const parsed = Date.parse(entry.ts);
  return Number.isFinite(parsed) ? parsed : null;
}

function includesGrep(entry: ServiceLogEntry, grep: string | undefined): boolean {
  if (!grep) return true;
  return JSON.stringify(entry).toLowerCase().includes(grep.toLowerCase());
}

export function filterServiceLogs(
  entries: ServiceLogEntry[],
  options: Partial<LogQueryOptions>,
): ServiceLogEntry[] {
  const now = Date.now();
  const since = parseTimeExpression(options.since, now);
  const until = parseTimeExpression(options.until, now);

  return entries.filter((entry) => {
    if (
      options.service &&
      options.service !== "all" &&
      entry.service !== options.service
    ) {
      return false;
    }
    if (options.session && entry.sessionId !== options.session) return false;
    if (options.trace && entry.traceId !== options.trace) return false;
    if (options.request && entry.requestId !== options.request) return false;
    if (options.space && entry.spaceId !== options.space) return false;
    if (options.user && entry.userId !== options.user) return false;
    if (options.agent && entry.agentId !== options.agent) return false;
    if (options.event && entry.event !== options.event) return false;
    if (
      options.level &&
      typeof entry.level === "string" &&
      entry.level.toLowerCase() !== options.level.toLowerCase()
    ) {
      return false;
    }
    if (
      options.level &&
      typeof entry.level !== "string"
    ) {
      return false;
    }
    if (!includesGrep(entry, options.grep)) return false;

    const entryTs = getEntryTimestamp(entry);
    if (since !== null && entryTs !== null && entryTs < since) return false;
    if (until !== null && entryTs !== null && entryTs > until) return false;

    return true;
  });
}

export function sortServiceLogsDescending(
  entries: ServiceLogEntry[],
): ServiceLogEntry[] {
  return [...entries].sort((left, right) => {
    const leftTs = getEntryTimestamp(left) ?? 0;
    const rightTs = getEntryTimestamp(right) ?? 0;
    return rightTs - leftTs;
  });
}

export function renderServiceLogLine(entry: ServiceLogEntry): string {
  const ts =
    typeof entry.ts === "string" && entry.ts.length >= 19
      ? entry.ts.slice(11, 19)
      : "??:??:??";
  const service = entry.service ?? "unknown";
  const level = entry.level ?? "INFO";
  const event = entry.event ?? "-";
  const message = entry.message ?? "";
  const ids = [
    entry.sessionId ? `session=${entry.sessionId}` : null,
    entry.traceId ? `trace=${entry.traceId}` : null,
    entry.requestId ? `request=${entry.requestId}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `${ts} [${service}] [${level}] ${event}${ids ? ` ${ids}` : ""}${message ? ` ${message}` : ""}`;
}
