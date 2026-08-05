import { Command } from "commander";

import { registerInsightsJobCommand } from "./job.js";

export function registerInsightsCommands(program: Command): void {
  const insightsCmd = program.command("insights").description("Inspect insight generation jobs");
  registerInsightsJobCommand(insightsCmd);
}
