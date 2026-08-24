import { Command } from "commander";
import { registerKnowledgeFolderCreateCommand } from "./create.js";
import { registerKnowledgeFolderDeleteCommand } from "./delete.js";
import { registerKnowledgeFolderListCommand } from "./list.js";

export function registerKnowledgeFolderCommands(knowledgeCmd: Command): void {
  const folderCmd = knowledgeCmd.command("folder").description("Manage knowledge folders");
  registerKnowledgeFolderListCommand(folderCmd);
  registerKnowledgeFolderCreateCommand(folderCmd);
  registerKnowledgeFolderDeleteCommand(folderCmd);
}
