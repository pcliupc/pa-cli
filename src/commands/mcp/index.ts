import { Command } from "commander";
import { registerMcpListCommand } from "./list.js";
import { registerMcpGetCommand } from "./get.js";
import { registerMcpCreateCommand } from "./create.js";
import { registerMcpDeleteCommand } from "./delete.js";

export function registerMcpCommands(program: Command): void {
  const mcpCmd = program.command("mcp").description("Manage MCP servers");
  registerMcpListCommand(mcpCmd);
  registerMcpGetCommand(mcpCmd);
  registerMcpCreateCommand(mcpCmd);
  registerMcpDeleteCommand(mcpCmd);
}
