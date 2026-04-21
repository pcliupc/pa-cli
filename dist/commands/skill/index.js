import { registerSkillListCommand } from "./list.js";
import { registerSkillImportCommand } from "./import.js";
import { registerSkillDeleteCommand } from "./delete.js";
export function registerSkillCommands(program) {
    const skillCmd = program.command("skill").description("Manage skills");
    registerSkillListCommand(skillCmd);
    registerSkillImportCommand(skillCmd);
    registerSkillDeleteCommand(skillCmd);
}
//# sourceMappingURL=index.js.map