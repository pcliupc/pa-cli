import { Command } from "commander";
import { registerSourceDocsListCommand } from "./list.js";
import { registerSourceDocsAddCommand } from "./add.js";
import { registerSourceDocsRemoveCommand } from "./remove.js";

export function registerSourceDocsCommands(liveArtifactCmd: Command): void {
  const sourceDocsCmd = liveArtifactCmd
    .command("source-docs")
    .description("Manage live artifact source documents");
  registerSourceDocsListCommand(sourceDocsCmd);
  registerSourceDocsAddCommand(sourceDocsCmd);
  registerSourceDocsRemoveCommand(sourceDocsCmd);
}
