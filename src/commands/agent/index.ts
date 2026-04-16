import { Command } from "commander";
import { registerAgentListCommand } from "./list.js";

export function registerAgentCommands(program: Command): void {
  const agentCmd = program.command("agent").description("Manage agents");
  registerAgentListCommand(agentCmd);
}
