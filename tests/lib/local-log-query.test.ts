import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { queryLocalLogs } from "../../src/lib/local-log-query.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-logs-"));
  tempDirs.push(dir);
  return dir;
}

function writeJsonl(root: string, service: "web" | "runtime", lines: object[]): void {
  const serviceDir = path.join(root, service);
  fs.mkdirSync(serviceDir, { recursive: true });
  fs.writeFileSync(
    path.join(serviceDir, "current.jsonl"),
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    "utf8",
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("queryLocalLogs", () => {
  it("reads local JSONL service logs from the configured root", async () => {
    const cwd = makeTempDir();
    const logRoot = path.join(cwd, ".logs");

    writeJsonl(logRoot, "web", [
      {
        ts: "2026-05-29T10:00:00.000Z",
        level: "INFO",
        service: "web",
        tenantId: "tenant-acme",
        event: "http.request.started",
        message: "request started",
        traceId: "trc_1",
        requestId: "req_1",
        sessionId: "sess_keep",
      },
    ]);

    writeJsonl(logRoot, "runtime", [
      {
        ts: "2026-05-29T10:05:00.000Z",
        level: "ERROR",
        service: "runtime",
        tenantId: "tenant-acme",
        event: "session.checkpoint.failed",
        message: "checkpoint failed",
        traceId: "trc_2",
        requestId: "req_2",
        sessionId: "sess_keep",
      },
      {
        ts: "2026-05-29T10:06:00.000Z",
        level: "INFO",
        service: "runtime",
        tenantId: "tenant-acme",
        event: "session.checkpoint.saved",
        message: "checkpoint saved",
        traceId: "trc_3",
        requestId: "req_3",
        sessionId: "sess_skip",
      },
    ]);

    const entries = await queryLocalLogs(
      {
        source: "local",
        service: "all",
        since: "2026-05-29T09:59:00.000Z",
        session: "sess_keep",
        limit: 10,
        level: "error",
      },
      { serverUrl: "http://localhost:3000", apiKey: "", localLogRoot: logRoot },
      cwd,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.service).toBe("runtime");
    expect(entries[0]?.event).toBe("session.checkpoint.failed");
  });
});
