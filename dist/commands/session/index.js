import { registerSessionListCommand } from "./list.js";
import { registerSessionGetCommand } from "./get.js";
import { registerSessionDeleteCommand } from "./delete.js";
import { registerSessionLogsCommand } from "./logs.js";
import { registerSessionFeedbackCommand } from "./feedback.js";
export function registerSessionCommands(program) {
    const sessionCmd = program.command("session").description("Manage sessions");
    registerSessionListCommand(sessionCmd);
    registerSessionGetCommand(sessionCmd);
    registerSessionDeleteCommand(sessionCmd);
    registerSessionLogsCommand(sessionCmd);
    registerSessionFeedbackCommand(sessionCmd);
}
//# sourceMappingURL=index.js.map