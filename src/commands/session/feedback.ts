import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface FeedbackRecord {
  resultQualityScore?: number;
  processDesignScore?: number;
  runtimeExecutionScore?: number;
  hasErrors?: boolean;
  efficiency?: string;
  expectedFlowMatch?: string;
  summary?: string;
  comment?: string;
  createdAt?: string;
}

interface FeedbackResponse {
  sessionId: string;
  userFeedback: FeedbackRecord | null;
  adminReview: FeedbackRecord | null;
}

export function registerSessionFeedbackCommand(sessionCmd: Command): void {
  sessionCmd
    .command("feedback")
    .description("Get session feedback")
    .argument("<id>", "Session ID")
    .action(async (sessionId: string) => {
      const config = loadConfig();
      const parentOpts = sessionCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });

      const spinner = ora("Loading feedback...").start();
      try {
        const resp = await client.getJson<FeedbackResponse>(
          `/api/sessions/${sessionId}/feedback`,
        );
        spinner.stop();

        if (outputFormat === "json") {
          console.log(JSON.stringify(resp, null, 2));
          return;
        }

        if (resp.userFeedback) {
          const fb = resp.userFeedback;
          console.log(chalk.bold("User Feedback:"));
          printScores(fb);
          if (fb.summary) console.log(`  Summary: ${fb.summary}`);
          if (fb.comment) console.log(`  Comment: ${fb.comment}`);
        } else {
          console.log(chalk.gray("User Feedback: (none)"));
        }

        if (resp.adminReview) {
          const fb = resp.adminReview;
          console.log(chalk.bold("\nAdmin Review:"));
          printScores(fb);
          if (fb.summary) console.log(`  Summary: ${fb.summary}`);
          if (fb.comment) console.log(`  Comment: ${fb.comment}`);
        } else {
          console.log(chalk.gray("\nAdmin Review: (none)"));
        }
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}

function printScores(fb: FeedbackRecord): void {
  const bar = (score?: number) => score ? "★".repeat(score) + "☆".repeat(5 - score) + ` (${score}/5)` : "-";
  console.log(`  Result Quality:    ${bar(fb.resultQualityScore)}`);
  console.log(`  Process Design:   ${bar(fb.processDesignScore)}`);
  console.log(`  Runtime Execution: ${bar(fb.runtimeExecutionScore)}`);
  if (fb.hasErrors !== undefined) console.log(`  Has Errors: ${fb.hasErrors ? chalk.red("Yes") : chalk.green("No")}`);
  if (fb.efficiency) console.log(`  Efficiency: ${fb.efficiency}`);
  if (fb.expectedFlowMatch) console.log(`  Flow Match: ${fb.expectedFlowMatch}`);
}
