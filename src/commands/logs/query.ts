import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../lib/config.js";
import {
  hasLocalLogSource,
  queryLocalLogs,
} from "../../lib/local-log-query.js";
import {
  renderServiceLogLine,
  type LogQueryOptions,
  type LogSource,
  type ServiceLogScope,
} from "../../lib/log-query.js";
import { type OutputFormat } from "../../lib/output.js";
import { hasSlsLogSource, querySlsLogs } from "../../lib/sls-log-query.js";

interface RawLogQueryCommandOptions {
  service?: string;
  source?: string;
  since?: string;
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
  limit?: string;
  json?: boolean;
}

const SERVICE_VALUES: ServiceLogScope[] = ["web", "runtime", "all"];
const SOURCE_VALUES: LogSource[] = ["auto", "local", "sls"];
const LEVEL_VALUES = ["debug", "info", "warn", "error"] as const;

function isServiceLogScope(value: string): value is ServiceLogScope {
  return SERVICE_VALUES.includes(value as ServiceLogScope);
}

function isLogSource(value: string): value is LogSource {
  return SOURCE_VALUES.includes(value as LogSource);
}

function normalizeLimit(value: string | undefined): number {
  const parsed = Number(value ?? "200");
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("limit must be a positive integer");
  }
  return parsed;
}

function normalizeService(value: string | undefined): ServiceLogScope {
  const normalized = (value ?? "all").toLowerCase();
  if (!isServiceLogScope(normalized)) {
    throw new Error("service must be one of: web, runtime, all");
  }
  return normalized;
}

function normalizeSource(value: string | undefined): LogSource {
  const normalized = (value ?? "auto").toLowerCase();
  if (!isLogSource(normalized)) {
    throw new Error("source must be one of: auto, local, sls");
  }
  return normalized;
}

function normalizeLevel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (!LEVEL_VALUES.includes(normalized as (typeof LEVEL_VALUES)[number])) {
    throw new Error("level must be one of: debug, info, warn, error");
  }
  return normalized;
}

function buildQueryOptions(
  options: RawLogQueryCommandOptions,
): LogQueryOptions {
  return {
    service: normalizeService(options.service),
    source: normalizeSource(options.source),
    since: options.since ?? "1h",
    until: options.until,
    session: options.session,
    trace: options.trace,
    request: options.request,
    space: options.space,
    user: options.user,
    agent: options.agent,
    level: normalizeLevel(options.level),
    event: options.event,
    grep: options.grep,
    limit: normalizeLimit(options.limit),
  };
}

async function runQuery(
  query: LogQueryOptions,
): Promise<Awaited<ReturnType<typeof queryLocalLogs>>> {
  const config = loadConfig();
  const cwd = process.cwd();

  if (query.source === "local") {
    return queryLocalLogs(query, config, cwd);
  }

  if (query.source === "sls") {
    return querySlsLogs(query, config);
  }

  if (hasLocalLogSource(config, query.service, cwd)) {
    return queryLocalLogs(query, config, cwd);
  }

  if (hasSlsLogSource(config, query.service)) {
    return querySlsLogs(query, config);
  }

  return queryLocalLogs(query, config, cwd);
}

export function registerLogsQueryCommand(logsCmd: Command): void {
  logsCmd
    .command("query")
    .description("Query structured Web/runtime service logs")
    .option("--service <service>", "web, runtime, or all", "all")
    .option("--source <source>", "auto, local, or sls", "auto")
    .option("--since <time>", "relative or absolute start time", "1h")
    .option("--until <time>", "relative or absolute end time")
    .option("--session <id>", "filter by session ID")
    .option("--trace <id>", "filter by trace ID")
    .option("--request <id>", "filter by request ID")
    .option("--space <id>", "filter by space ID")
    .option("--user <id>", "filter by user ID")
    .option("--agent <id>", "filter by agent ID")
    .option("--level <level>", "debug, info, warn, or error")
    .option("--event <name>", "filter by event name")
    .option("--grep <text>", "search rendered JSON payload")
    .option("--limit <n>", "maximum log entries", "200")
    .option("--json", "output raw JSON entries")
    .action(async (options: RawLogQueryCommandOptions) => {
      const spinner = ora("Querying service logs...").start();
      try {
        const query = buildQueryOptions(options);
        const entries = await runQuery(query);
        spinner.stop();

        const outputFormat = (
          options.json
            ? "json"
            : ((logsCmd.parent?.opts?.() as { output?: string } | undefined)
                ?.output ?? "table")
        ) as OutputFormat;

        if (entries.length === 0) {
          console.log(chalk.gray("No service logs found."));
          return;
        }

        if (outputFormat === "json") {
          console.log(JSON.stringify(entries, null, 2));
          return;
        }

        for (const entry of entries) {
          console.log(renderServiceLogLine(entry));
        }

        console.log(chalk.gray(`\n${entries.length} log entries`));
      } catch (err) {
        spinner.stop();
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
    });
}
