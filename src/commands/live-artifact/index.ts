import { Command } from "commander";
import { registerLiveArtifactListCommand } from "./list.js";
import { registerLiveArtifactGetCommand } from "./get.js";
import { registerLiveArtifactPublishCommand } from "./publish.js";
import { registerLiveArtifactUpdateCommand } from "./update.js";
import { registerLiveArtifactRefreshCommand } from "./refresh.js";
import { registerLiveArtifactDeleteCommand } from "./delete.js";
import { registerSourceDocsCommands } from "./source-docs/index.js";

export function registerLiveArtifactCommands(program: Command): void {
  const liveArtifactCmd = program
    .command("live-artifact")
    .description("Manage live artifacts");
  registerLiveArtifactListCommand(liveArtifactCmd);
  registerLiveArtifactGetCommand(liveArtifactCmd);
  registerLiveArtifactPublishCommand(liveArtifactCmd);
  registerLiveArtifactUpdateCommand(liveArtifactCmd);
  registerLiveArtifactRefreshCommand(liveArtifactCmd);
  registerLiveArtifactDeleteCommand(liveArtifactCmd);
  registerSourceDocsCommands(liveArtifactCmd);
}
