import { Command } from "commander";
import ora from "ora";

import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { confirmUseAvailable, createInsightJob, formatInsightCoverage, formatInsightJobOutcome, isSuccessfulInsightJob, preflightInsightJob, type InsightJobType, waitForInsightJob } from "../../lib/insight-jobs.js";
import { defaultInsightOutputRoot, writeInsightEvaluation } from "../../lib/insight-output.js";
import type { OutputFormat } from "../../lib/output.js";

function selectedTypes(type: "business" | "design" | "all"): InsightJobType[] {
  return type === "all" ? ["business", "design"] : [type];
}

export function registerAgentInsightsCommand(agentCmd: Command): void {
  agentCmd.command("insights").description("Generate business and design insights for one agent")
    .argument("<id>", "Agent ID").option("--persist", "Overwrite the formal agent insight")
    .option("--type <type>", "business, design, or all", "all").option("--version <id>", "Agent version ID")
    .option("--use-available", "Continue when only available Session Insights can be used")
    .option("--output-dir <path>", "Directory for local evaluation output")
    .action(async (agentId: string, options: { persist?: boolean; type?: "business" | "design" | "all"; version?: string; useAvailable?: boolean; outputDir?: string }) => {
      const type = options.type ?? "all";
      if (type !== "business" && type !== "design" && type !== "all") throw new Error("--type must be business, design, or all.");
      const config = loadConfig();
      const parentOpts = agentCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;
      const client = new PaApiClient({ serverUrl: parentOpts?.server ?? config.serverUrl, apiKey: config.apiKey });
      const insightTypes = selectedTypes(type);
      const preflight = await preflightInsightJob({ client, targetType: "agent", targetId: agentId, insightTypes, agentVersionId: options.version });
      if (outputFormat !== "json") console.log(formatInsightCoverage(preflight));
      let useAvailable = options.useAvailable === true;
      if (preflight.requiresConfirmation && !useAvailable) {
        if (outputFormat === "json" || !await confirmUseAvailable({ coverage: preflight })) {
          throw new Error("Agent insight coverage is incomplete; re-run with --use-available.");
        }
        useAvailable = true;
      }
      const spinner = outputFormat === "json" ? null : ora("Creating agent insight job...").start();
      const controller = new AbortController();
      const onInterrupt = () => controller.abort();
      process.once("SIGINT", onInterrupt);
      try {
        const created = await createInsightJob({ client, targetType: "agent", targetId: agentId, insightTypes, outputMode: options.persist ? "persist" : "local", agentVersionId: options.version, useAvailable });
        const job = await waitForInsightJob({ client, jobId: created.jobId, signal: controller.signal, onStatus: (status) => {
          if (spinner) spinner.text = `Insight job ${status.status}${status.progressStage ? ` (${status.progressStage})` : ""}...`;
        } });
        const evaluation = await writeInsightEvaluation({ rootDir: options.outputDir ?? defaultInsightOutputRoot(), job });
        spinner?.stop();
        const outcome = formatInsightJobOutcome({ jobId: job.jobId, status: job.status, directory: evaluation.directory });
        if (!isSuccessfulInsightJob(job.status)) {
          if (outputFormat !== "json") console.error(outcome);
          throw new Error(outcome);
        }
        if (outputFormat === "json") console.log(JSON.stringify({ preflight, job, evaluation }, null, 2));
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
