import { Command } from "commander";

import { registerUsageClearCommand } from "./clear.js";

export function registerUsageCommands(program: Command): void {
  const usageCmd = program.command("usage").description("Manage usage analytics");
  registerUsageClearCommand(usageCmd);
}
