import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerKnowledgeCommands } from "../../src/commands/knowledge/index.js";

describe("knowledge command registration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the knowledge command tree", () => {
    const program = new Command().exitOverride();
    registerKnowledgeCommands(program);

    const knowledge = program.commands.find((command) => command.name() === "knowledge");
    expect(knowledge?.commands.map((command) => command.name())).toEqual([
      "list", "get", "create", "update", "delete", "folder",
    ]);

    const folder = knowledge?.commands.find((command) => command.name() === "folder");
    expect(folder?.commands.map((command) => command.name())).toEqual([
      "list", "create", "delete",
    ]);
  });

  it("parses knowledge help without invoking API methods", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const program = new Command().exitOverride();
    registerKnowledgeCommands(program);

    await expect(
      program.parseAsync(["node", "pa", "knowledge", "--help"], { from: "node" }),
    ).rejects.toMatchObject({ code: "commander.helpDisplayed", exitCode: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
