import ora from "ora";
import chalk from "chalk";
import readline from "node:readline";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
export function registerSessionDeleteCommand(sessionCmd) {
    sessionCmd
        .command("delete")
        .description("Delete a session")
        .argument("<id>", "Session ID")
        .option("-f, --force", "Skip confirmation prompt")
        .action(async (sessionId, options) => {
        const config = loadConfig();
        const client = new PaApiClient({ serverUrl: config.serverUrl, apiKey: config.apiKey });
        if (!options.force) {
            const confirmed = await confirmPrompt(`Delete session "${sessionId}"?`);
            if (!confirmed) {
                console.log("Cancelled.");
                return;
            }
        }
        const spinner = ora(`Deleting session "${sessionId.slice(0, 12)}..."...`).start();
        try {
            await client.delete(`/api/sessions/${sessionId}`);
            spinner.stop();
            console.log(chalk.green(`✓ Session "${sessionId.slice(0, 12)}..." deleted`));
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
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`${question} (y/N) `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
        });
    });
}
//# sourceMappingURL=delete.js.map