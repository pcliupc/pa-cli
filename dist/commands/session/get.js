import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
export function registerSessionGetCommand(sessionCmd) {
    sessionCmd
        .command("get")
        .description("Get session details")
        .argument("<id>", "Session ID")
        .action(async (sessionId) => {
        const config = loadConfig();
        const parentOpts = sessionCmd.parent?.opts?.();
        const serverUrl = parentOpts?.server ?? config.serverUrl;
        const outputFormat = (parentOpts?.output ?? "table");
        const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });
        const spinner = ora("Loading session...").start();
        try {
            const session = await client.getJson(`/api/sessions/${sessionId}`);
            spinner.stop();
            if (outputFormat === "json") {
                console.log(JSON.stringify(session, null, 2));
                return;
            }
            // Summary output
            console.log(chalk.bold(`Session: ${session.title || session.session_id}`));
            console.log(`  ID:      ${session.session_id}`);
            console.log(`  Agent:   ${session.agent_id}`);
            console.log(`  Status:  ${session.status}`);
            console.log(`  Created: ${session.created_at.slice(0, 19).replace("T", " ")}`);
            console.log(`  Updated: ${session.updated_at.slice(0, 19).replace("T", " ")}`);
            if (session.stages && session.stages.length > 0) {
                console.log(chalk.bold("\n  Stages:"));
                for (const stage of session.stages) {
                    const statusIcon = stage.status === "completed" ? "✓" : stage.status === "active" ? "●" : "○";
                    const skills = stage.skills?.length > 0 ? ` [${stage.skills.join(", ")}]` : "";
                    console.log(`    ${statusIcon} ${stage.label} (${stage.status})${skills}`);
                }
            }
        }
        catch (err) {
            spinner.stop();
            console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=get.js.map