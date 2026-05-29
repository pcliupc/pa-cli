import fs from "node:fs";
import path from "node:path";
import type { PaConfig } from "./config.js";
import {
  filterServiceLogs,
  parseServiceLogLine,
  sortServiceLogsDescending,
  type LogQueryOptions,
  type ServiceLogEntry,
  type ServiceLogName,
} from "./log-query.js";

function resolveCandidateRoots(config: PaConfig, cwd: string): string[] {
  const candidates = [
    config.localLogRoot,
    path.join(cwd, ".logs"),
    path.join(cwd, "..", ".logs"),
  ].filter((entry): entry is string => Boolean(entry && entry.trim()));

  return [...new Set(candidates.map((entry) => path.resolve(entry)))];
}

function listJsonlFiles(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

function readJsonlFile(filePath: string): ServiceLogEntry[] {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [parseServiceLogLine(line)];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function loadEntriesFromRoot(
  root: string,
  service: ServiceLogName | "all",
): ServiceLogEntry[] {
  const services: ServiceLogName[] =
    service === "all" ? ["web", "runtime"] : [service];

  return services.flatMap((name) =>
    listJsonlFiles(path.join(root, name)).flatMap((filePath) =>
      readJsonlFile(filePath),
    ),
  );
}

export async function queryLocalLogs(
  options: LogQueryOptions,
  config: PaConfig,
  cwd: string = process.cwd(),
): Promise<ServiceLogEntry[]> {
  const roots = resolveCandidateRoots(config, cwd);
  if (roots.length === 0) return [];

  const entries = roots.flatMap((root) =>
    loadEntriesFromRoot(root, options.service),
  );

  const filtered = filterServiceLogs(entries, options);
  return sortServiceLogsDescending(filtered).slice(0, options.limit);
}
