import { Command } from "commander";
import ora from "ora";

import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { createInsightJob, isSuccessfulInsightJob, waitForInsightJob } from "../../lib/insight-jobs.js";
import { defaultInsightOutputRoot, writeInsightEvaluation } from "../../lib/insight-output.js";
import type { OutputFormat } from "../../lib/output.js";

export function registerSessionSummarizeCommand(sessionCmd: Command): void {
  sessionCmd.command("summarize").description("Generate a summary for one session")
    .argument("<id>", "Session ID").option("--persist", "Overwrite the formal session insight")
    .option("--output-dir <path>", "Directory for local evaluation output")
    .action(async (sessionId: string, options: { persist?: boolean; outputDir?: string }) => {
      const config = loadConfig();
      const parentOpts = sessionCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const client = new PaApiClient({ serverUrl: parentOpts?.server ?? config.serverUrl, apiKey: config.apiKey });
      const spinner = outputFormat === "json" ? null : ora("Creating session summary job...").start();
      try {
        const created = await createInsightJob({ client, targetType: "session", targetId: sessionId, insightTypes: ["summary"], outputMode: options.persist ? "persist" : "local" });
        const job = await waitForInsightJob({ client, jobId: created.jobId, onStatus: (status) => {
          if (spinner) spinner.text = `Insight job ${status.status}${status.progressStage ? ` (${status.progressStage})` : ""}...`;
        } });
        const evaluation = await writeInsightEvaluation({ rootDir: options.outputDir ?? defaultInsightOutputRoot(), job });
        spinner?.stop();
        if (outputFormat === "json") console.log(JSON.stringify({ job, evaluation }, null, 2));
        else console.log(`Session summary saved to ${evaluation.directory}`);
        if (!isSuccessfulInsightJob(job.status)) throw new Error(`Insight job finished with status ${job.status}.`);
      } catch (error) {
        spinner?.stop();
        process.exitCode = 1;
        throw error;
      }
    });
}
