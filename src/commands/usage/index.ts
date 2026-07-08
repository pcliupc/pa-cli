import { Command } from "commander";

import { registerUsageClearCommand } from "./clear.js";
import { registerUsageGetCommand } from "./get.js";

export function registerUsageCommands(program: Command): void {
  const usageCmd = program.command("usage").description("Manage usage analytics");
  registerUsageGetCommand(usageCmd);
  registerUsageClearCommand(usageCmd);
}
