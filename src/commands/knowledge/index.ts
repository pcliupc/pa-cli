import { Command } from "commander";
import { registerKnowledgeCreateCommand } from "./create.js";
import { registerKnowledgeDeleteCommand } from "./delete.js";
import { registerKnowledgeGetCommand } from "./get.js";
import { registerKnowledgeListCommand } from "./list.js";
import { registerKnowledgeUpdateCommand } from "./update.js";
import { registerKnowledgeFolderCommands } from "./folder/index.js";

export function registerKnowledgeCommands(program: Command): void {
  const knowledgeCmd = program
    .command("knowledge")
    .description("Manage knowledge documents and folders");

  registerKnowledgeListCommand(knowledgeCmd);
  registerKnowledgeGetCommand(knowledgeCmd);
  registerKnowledgeCreateCommand(knowledgeCmd);
  registerKnowledgeUpdateCommand(knowledgeCmd);
  registerKnowledgeDeleteCommand(knowledgeCmd);
  registerKnowledgeFolderCommands(knowledgeCmd);
}
