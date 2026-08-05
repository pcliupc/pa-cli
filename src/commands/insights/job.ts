import { Command } from "commander";
import ora from "ora";

import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { formatInsightJobOutcome, isSuccessfulInsightJob, waitForInsightJob } from "../../lib/insight-jobs.js";
import { defaultInsightOutputRoot, writeInsightEvaluation } from "../../lib/insight-output.js";
import type { OutputFormat } from "../../lib/output.js";

export function registerInsightsJobCommand(insightsCmd: Command): void {
  insightsCmd.command("job").description("Wait for and download an insight generation job")
    .argument("<job-id>", "Insight job ID").requiredOption("--wait", "Wait for the job result before downloading")
    .option("--output-dir <path>", "Directory for local evaluation output")
    .action(async (jobId: string, options: { wait?: boolean; outputDir?: string }) => {
      if (!options.wait) throw new Error("--wait is required to download an insight job result.");
      const config = loadConfig();
      const parentOpts = insightsCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const client = new PaApiClient({ serverUrl: parentOpts?.server ?? config.serverUrl, apiKey: config.apiKey });
      const spinner = outputFormat === "json" ? null : ora(`Waiting for insight job ${jobId}...`).start();
      const controller = new AbortController();
      const onInterrupt = () => controller.abort();
      process.once("SIGINT", onInterrupt);
      try {
        const job = await waitForInsightJob({ client, jobId, signal: controller.signal, onStatus: (status) => {
          if (spinner) spinner.text = `Insight job ${status.status}${status.progressStage ? ` (${status.progressStage})` : ""}...`;
        } });
        const evaluation = await writeInsightEvaluation({ rootDir: options.outputDir ?? defaultInsightOutputRoot(), job });
        spinner?.stop();
        const outcome = formatInsightJobOutcome({ jobId: job.jobId, status: job.status, directory: evaluation.directory });
        if (!isSuccessfulInsightJob(job.status)) {
          if (outputFormat !== "json") console.error(outcome);
          throw new Error(outcome);
        }
        if (outputFormat === "json") console.log(JSON.stringify({ job, evaluation }, null, 2));
        else console.log(outcome);
      } catch (error) {
        spinner?.stop();
        process.exitCode = 1;
        throw error;
      } finally {
        process.removeListener("SIGINT", onInterrupt);
      }
    });
}
