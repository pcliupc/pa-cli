import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import { registerLogsCommands } from "../../src/commands/logs/index.js";

describe("logs query command", () => {
  it("registers pa logs query and defaults to auto source", () => {
    const program = new Command();
    registerLogsCommands(program);

    const logsCommand = program.commands.find((entry) => entry.name() === "logs");
    expect(logsCommand).toBeTruthy();

    const queryCommand = logsCommand?.commands.find(
      (entry) => entry.name() === "query",
    );

    expect(queryCommand).toBeTruthy();
    expect(
      queryCommand?.options.find((entry) => entry.long === "--source")
        ?.defaultValue,
    ).toBe("auto");
  });

  it("uses aliyunlog when source=sls and config provides SLS metadata", async () => {
    const mod = await import("../../src/lib/sls-log-query.js");
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        data: [{ service: "runtime", level: "ERROR", event: "runtime.failed" }],
      }),
      stderr: "",
    });

    const entries = await mod.querySlsLogs(
      {
        source: "sls",
        service: "runtime",
        since: "1h",
        limit: 50,
      },
      {
        serverUrl: "http://localhost:3000",
        apiKey: "key",
        slsProject: "pa-prod",
        slsRuntimeLogstore: "runtime-logs",
        aliyunProfile: "default",
      },
      run,
    );

    expect(run).toHaveBeenCalled();
    expect(entries[0]?.service).toBe("runtime");
  });
});
