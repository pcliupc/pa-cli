import { Command } from "commander";
import { registerSpaceListCommand } from "./list.js";
import { registerSpaceGetCommand } from "./get.js";

export function registerSpaceCommands(program: Command): void {
  const spaceCmd = program.command("space").description("Manage spaces");
  registerSpaceListCommand(spaceCmd);
  registerSpaceGetCommand(spaceCmd);
}
