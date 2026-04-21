import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
export function registerSessionFeedbackCommand(sessionCmd) {
    sessionCmd
        .command("feedback")
        .description("Get session feedback")
        .argument("<id>", "Session ID")
        .action(async (sessionId) => {
        const config = loadConfig();
        const parentOpts = sessionCmd.parent?.opts?.();
        const serverUrl = parentOpts?.server ?? config.serverUrl;
        const outputFormat = (parentOpts?.output ?? "table");
        const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });
        const spinner = ora("Loading feedback...").start();
        try {
            const resp = await client.getJson(`/api/sessions/${sessionId}/feedback`);
            spinner.stop();
            if (outputFormat === "json") {
                console.log(JSON.stringify(resp, null, 2));
                return;
            }
            if (resp.userFeedback) {
                const fb = resp.userFeedback;
                console.log(chalk.bold("User Feedback:"));
                printScores(fb);
                if (fb.summary)
                    console.log(`  Summary: ${fb.summary}`);
                if (fb.comment)
                    console.log(`  Comment: ${fb.comment}`);
            }
            else {
                console.log(chalk.gray("User Feedback: (none)"));
            }
            if (resp.adminReview) {
                const fb = resp.adminReview;
                console.log(chalk.bold("\nAdmin Review:"));
                printScores(fb);
                if (fb.summary)
                    console.log(`  Summary: ${fb.summary}`);
                if (fb.comment)
                    console.log(`  Comment: ${fb.comment}`);
            }
            else {
                console.log(chalk.gray("\nAdmin Review: (none)"));
            }
        }
        catch (err) {
            spinner.stop();
            console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
}
function printScores(fb) {
    const bar = (score) => score ? "★".repeat(score) + "☆".repeat(5 - score) + ` (${score}/5)` : "-";
    console.log(`  Result Quality:    ${bar(fb.resultQualityScore)}`);
    console.log(`  Process Design:   ${bar(fb.processDesignScore)}`);
    console.log(`  Runtime Execution: ${bar(fb.runtimeExecutionScore)}`);
    if (fb.hasErrors !== undefined)
        console.log(`  Has Errors: ${fb.hasErrors ? chalk.red("Yes") : chalk.green("No")}`);
    if (fb.efficiency)
        console.log(`  Efficiency: ${fb.efficiency}`);
    if (fb.expectedFlowMatch)
        console.log(`  Flow Match: ${fb.expectedFlowMatch}`);
}
//# sourceMappingURL=feedback.js.map