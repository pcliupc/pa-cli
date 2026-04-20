import { describe, it, expect } from "vitest";
import {
  formatLogTimestamp,
  normalizeLogEntry,
  renderLogEntryLine,
} from "../../src/commands/session/logs.js";

describe("session logs compatibility", () => {
  it("renders modern log payloads with numeric timestamps", () => {
    const line = renderLogEntryLine({
      timestamp: Date.UTC(2026, 3, 20, 9, 8, 7),
      type: "tool_call",
      toolName: "Read",
      content: "opened file",
    });

    expect(line).toContain("09:08:07");
    expect(line).toContain("[tool_call]");
    expect(line).toContain("Read");
  });

  it("normalizes legacy log payloads with logType and ISO timestamps", () => {
    const entry = normalizeLogEntry({
      timestamp: "2026-04-20T09:08:07.000Z",
      logType: "reasoning",
      content: "thinking",
    });

    expect(entry.type).toBe("reasoning");
    expect(entry.timestampText).toBe("09:08:07");
  });

  it("falls back for invalid timestamps", () => {
    expect(formatLogTimestamp(null)).toBe("??:??:??");
    expect(formatLogTimestamp("not-a-date")).toBe("??:??:??");
  });

  it("renders the error icon for error logs", () => {
    const line = renderLogEntryLine({
      timestamp: Date.UTC(2026, 3, 20, 9, 8, 7),
      type: "tool_call",
      isError: true,
      status: "error",
    });

    expect(line).toContain("✗");
  });
});
