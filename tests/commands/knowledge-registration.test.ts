import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { registerKnowledgeCommands } from "../../src/commands/knowledge/index.js";

describe("knowledge command registration", () => {
  it("registers the knowledge command tree", () => {
    const program = new Command().exitOverride();
    registerKnowledgeCommands(program);

    const knowledge = program.commands.find((command) => command.name() === "knowledge");
    expect(knowledge?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["list", "get", "create", "update", "delete", "folder"]),
    );
  });
});
