import ora from "ora";
import chalk from "chalk";
import readline from "node:readline";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
export function registerAgentDeleteCommand(agentCmd) {
    agentCmd
        .command("delete")
        .description("Delete an agent")
        .argument("<id>", "Agent ID")
        .option("-f, --force", "Skip confirmation prompt")
        .action(async (agentId, options) => {
        const config = loadConfig();
        const client = new PaApiClient({
            serverUrl: config.serverUrl,
            apiKey: config.apiKey,
        });
        if (!options.force) {
            const confirmed = await confirm(`Delete agent "${agentId}"?`);
            if (!confirmed) {
                console.log("Cancelled.");
                return;
            }
        }
        const spinner = ora(`Deleting agent "${agentId}"...`).start();
        try {
            await client.delete(`/api/agents/${agentId}`);
            spinner.stop();
            console.log(chalk.green(`✓ Agent "${agentId}" deleted`));
        }
        catch (err) {
            spinner.stop();
            console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
        }
    });
}
function confirm(question) {
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