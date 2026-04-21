import ora from "ora";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
export function registerAgentUploadCommand(agentCmd) {
    agentCmd
        .command("upload")
        .description("Upload an agent (yaml, zip, or directory)")
        .argument("<path>", "Path to config.yaml, .zip file, or agent directory")
        .option("--overwrite", "Overwrite existing agent with same ID")
        .action(async (inputPath, options) => {
        const config = loadConfig();
        const client = new PaApiClient({
            serverUrl: config.serverUrl,
            apiKey: config.apiKey,
        });
        const resolvedPath = path.resolve(inputPath);
        if (!fs.existsSync(resolvedPath)) {
            console.error(chalk.red(`Error: Path not found: ${resolvedPath}`));
            process.exit(1);
        }
        const spinner = ora("Uploading agent...").start();
        try {
            const formData = new FormData();
            const stat = fs.statSync(resolvedPath);
            if (stat.isFile()) {
                const ext = path.extname(resolvedPath).toLowerCase();
                if (ext !== ".yaml" && ext !== ".yml" && ext !== ".zip") {
                    spinner.stop();
                    console.error(chalk.red("Error: Unsupported file type. Use .yaml, .yml, or .zip files."));
                    process.exit(1);
                }
                const buffer = fs.readFileSync(resolvedPath);
                const fileName = path.basename(resolvedPath);
                formData.append("file", new Blob([buffer]), fileName);
            }
            else if (stat.isDirectory()) {
                const files = walkDir(resolvedPath);
                if (files.length === 0) {
                    spinner.stop();
                    console.error(chalk.red("Error: Directory is empty."));
                    process.exit(1);
                }
                for (const filePath of files) {
                    const buffer = fs.readFileSync(filePath);
                    const relativePath = path.relative(resolvedPath, filePath);
                    formData.append("files[]", new Blob([buffer]), relativePath);
                    formData.append("paths[]", relativePath);
                }
            }
            if (options.overwrite) {
                formData.append("overwrite", "true");
            }
            const result = await client.postMultipart("/api/agents/upload", formData);
            spinner.stop();
            console.log(chalk.green(`✓ Agent "${result.agent_id}" uploaded successfully (${result.status})`));
        }
        catch (err) {
            spinner.stop();
            console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
        }
    });
}
function walkDir(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name.startsWith("."))
            continue;
        if (entry.isDirectory()) {
            results.push(...walkDir(fullPath));
        }
        else if (entry.isFile()) {
            results.push(fullPath);
        }
    }
    return results;
}
//# sourceMappingURL=upload.js.map