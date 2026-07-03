import { Command } from "commander";
import { registerExampleListCommand } from "./list.js";
import { registerExampleImportCommand } from "./import.js";
import { registerExampleExportSessionCommand } from "./export-session.js";
import { registerExampleDeleteCommand } from "./delete.js";

export function registerExampleCommands(program: Command): void {
  const exampleCmd = program.command("example").description("Manage session examples");
  registerExampleListCommand(exampleCmd);
  registerExampleImportCommand(exampleCmd);
  registerExampleExportSessionCommand(exampleCmd);
  registerExampleDeleteCommand(exampleCmd);
}

