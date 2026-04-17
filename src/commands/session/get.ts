import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData, type OutputFormat } from "../../lib/output.js";

interface SessionDetail {
  session_id: string;
  agent_id: string;
  title: string;
  status: string;
  current_stage_id: string | null;
  created_at: string;
  updated_at: string;
  stages: Array<{ id: string; label: string; status: string; skills: string[] }>;
  usage_summary: Record<string, unknown> | null;
}

export function registerSessionGetCommand(sessionCmd: Command): void {
  sessionCmd
    .command("get")
    .description("Get session details")
    .argument("<id>", "Session ID")
    .action(async (sessionId: string) => {
      const config = loadConfig();
      const parentOpts = sessionCmd.parent?.opts?.() as { output?: string; server?: string } | undefined;
      const serverUrl = parentOpts?.server ?? config.serverUrl;
      const outputFormat = (parentOpts?.output ?? "table") as OutputFormat;

      const client = new PaApiClient({ serverUrl, apiKey: config.apiKey });

      const spinner = ora("Loading session...").start();
      try {
        const session = await client.getJson<SessionDetail>(
          `/api/sessions/${sessionId}`,
        );
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
      } catch (err) {
        spinner.stop();
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
