import ora from "ora";
import chalk from "chalk";
import readline from "node:readline";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
export function registerSkillDeleteCommand(skillCmd) {
    skillCmd
        .command("delete")
        .description("Delete a skill by name")
        .argument("<name>", "Skill name")
        .option("-f, --force", "Skip confirmation prompt")
        .action(async (skillName, options) => {
        const config = loadConfig();
        const client = new PaApiClient({
            serverUrl: config.serverUrl,
            apiKey: config.apiKey,
        });
        const spinner = ora(`Looking up skill "${skillName}"...`).start();
        try {
            const skills = await client.getJson("/api/skills");
            const skill = skills.find((s) => s.name === skillName);
            if (!skill) {
                spinner.stop();
                console.error(chalk.red(`Error: Skill "${skillName}" not found.`));
                process.exit(1);
            }
            spinner.stop();
            if (!options.force) {
                const confirmed = await confirmPrompt(`Delete skill "${skillName}"?`);
                if (!confirmed) {
                    console.log("Cancelled.");
                    return;
                }
            }
            const deleteSpinner = ora(`Deleting skill "${skillName}"...`).start();
            try {
                await client.delete(`/api/skills/${skill.id}`);
                deleteSpinner.stop();
                console.log(chalk.green(`✓ Skill "${skillName}" deleted`));
            }
            catch (err) {
                deleteSpinner.stop();
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes("referenced") || msg.includes("引用")) {
                    console.error(chalk.red(`Error: Skill "${skillName}" is referenced by agents and cannot be deleted.`));
                }
                else {
                    console.error(chalk.red(`Error: ${msg}`));
                }
                process.exit(1);
            }
        }
        catch (err) {
            spinner.stop();
            console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
        }
    });
}
function confirmPrompt(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(`${question} (y/N) `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
        });
    });
}
//# sourceMappingURL=delete.js.map