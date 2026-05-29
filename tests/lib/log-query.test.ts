import { describe, it, expect } from "vitest";
import {
  filterServiceLogs,
  parseServiceLogLine,
} from "../../src/lib/log-query.js";

describe("service log query helpers", () => {
  it("parses JSONL lines and filters by service, session, and level", () => {
    const entry = parseServiceLogLine(
      JSON.stringify({
        ts: "2026-05-29T10:15:23.481Z",
        level: "ERROR",
        service: "runtime",
        tenantId: "tenant-acme",
        event: "session.checkpoint.failed",
        message: "boom",
        traceId: "trc_1",
        requestId: "req_1",
        sessionId: "sess_1",
      }),
    );

    const filtered = filterServiceLogs([entry], {
      service: "runtime",
      session: "sess_1",
      level: "error",
      grep: "boom",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.event).toBe("session.checkpoint.failed");
  });
});
