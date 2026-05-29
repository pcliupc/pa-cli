import { describe, it, expect } from "vitest";
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
});
