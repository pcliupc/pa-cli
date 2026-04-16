import { Command } from "commander";
import { registerAgentListCommand } from "./list.js";
import { registerAgentUploadCommand } from "./upload.js";
import { registerAgentDownloadCommand } from "./download.js";
import { registerAgentDeleteCommand } from "./delete.js";

export function registerAgentCommands(program: Command): void {
  const agentCmd = program.command("agent").description("Manage agents");
  registerAgentListCommand(agentCmd);
  registerAgentUploadCommand(agentCmd);
  registerAgentDownloadCommand(agentCmd);
  registerAgentDeleteCommand(agentCmd);
}
