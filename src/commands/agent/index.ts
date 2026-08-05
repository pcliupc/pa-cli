import { Command } from "commander";
import { registerAgentListCommand } from "./list.js";
import { registerAgentGetCommand } from "./get.js";
import { registerAgentUploadCommand } from "./upload.js";
import { registerAgentDownloadCommand } from "./download.js";
import { registerAgentDeleteCommand } from "./delete.js";
import { registerAgentVersionCommands } from "./version.js";
import { registerAgentInsightsCommand } from "./insights.js";

export function registerAgentCommands(program: Command): void {
  const agentCmd = program.command("agent").description("Manage agents");
  registerAgentListCommand(agentCmd);
  registerAgentGetCommand(agentCmd);
  registerAgentVersionCommands(agentCmd);
  registerAgentUploadCommand(agentCmd);
  registerAgentDownloadCommand(agentCmd);
  registerAgentDeleteCommand(agentCmd);
  registerAgentInsightsCommand(agentCmd);
}
