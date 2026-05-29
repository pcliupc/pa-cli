import { Command } from "commander";
import { registerLogsQueryCommand } from "./query.js";

export function registerLogsCommands(program: Command): void {
  const logsCmd = program.command("logs").description("Query service logs");
  registerLogsQueryCommand(logsCmd);
}
