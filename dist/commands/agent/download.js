import ora from "ora";
import chalk from "chalk";
import path from "node:path";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
export function registerAgentDownloadCommand(agentCmd) {
    agentCmd
        .command("download")
        .description("Download an agent as a zip file")
        .argument("<id>", "Agent ID")
        .option("-o, --output <path>", "Output file path")
        .action(async (agentId, options) => {
        const config = loadConfig();
        const client = new PaApiClient({
            serverUrl: config.serverUrl,
            apiKey: config.apiKey,
        });
        const outputPath = options.output
            ? path.resolve(options.output)
            : path.resolve(`${agentId}.zip`);
        const spinner = ora(`Downloading agent "${agentId}"...`).start();
        try {
            await client.downloadFile(`/api/agents/${agentId}/download`, outputPath);
            spinner.stop();
            console.log(chalk.green(`✓ Agent "${agentId}" downloaded to ${outputPath}`));
        }
        catch (err) {
            spinner.stop();
            console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
        }
    });
}
//# sourceMappingURL=download.js.map