import { Command } from "commander";
import { registerSessionListCommand } from "./list.js";
import { registerSessionGetCommand } from "./get.js";
import { registerSessionDeleteCommand } from "./delete.js";
import { registerSessionLogsCommand } from "./logs.js";
import { registerSessionFeedbackCommand } from "./feedback.js";
import { registerSessionWorkspaceCommand } from "./workspace.js";

export function registerSessionCommands(program: Command): void {
  const sessionCmd = program.command("session").description("Manage sessions");
  registerSessionListCommand(sessionCmd);
  registerSessionGetCommand(sessionCmd);
  registerSessionDeleteCommand(sessionCmd);
  registerSessionLogsCommand(sessionCmd);
  registerSessionFeedbackCommand(sessionCmd);
  registerSessionWorkspaceCommand(sessionCmd);
}
