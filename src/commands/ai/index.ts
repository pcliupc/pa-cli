import { Command } from "commander";
import { registerAiConfigCommands } from "./config.js";

export function registerAiCommands(program: Command): void {
  const aiCmd = program.command("ai").description("Manage PA AI settings");
  registerAiConfigCommands(aiCmd);
}
