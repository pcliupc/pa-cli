import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData } from "../../lib/output.js";
export function registerAgentListCommand(agentCmd) {
    agentCmd
        .command("list")
        .description("List all agents")
        .option("--all", "Include inactive agents")
        .option("--category <id>", "Filter by category")
        .action(async (options) => {
        const config = loadConfig();
        const parentOpts = agentCmd.parent?.parent?.opts?.();
        const serverUrl = parentOpts?.server ?? config.serverUrl;
        const outputFormat = (parentOpts?.output ?? "table");
        const client = new PaApiClient({
            serverUrl,
            apiKey: config.apiKey,
        });
        const spinner = ora("Loading agents...").start();
        try {
            const params = new URLSearchParams();
            if (options.all)
                params.set("all", "true");
            if (options.category)
                params.set("category", options.category);
            const qs = params.toString();
            const raw = await client.getJson(`/api/agents${qs ? `?${qs}` : ""}`);
            const agents = Array.isArray(raw) ? raw : raw.items;
            spinner.stop();
            if (agents.length === 0) {
                console.log("No agents found.");
                return;
            }
            outputData(agents, outputFormat, ["ID", "Name", "Description", "Active", "Stages", "Updated"], agents.map((a) => [
                a.agent_id,
                a.name,
                (a.description || "").slice(0, 30),
                a.isActive ? "✓" : "✗",
                String(a.stage_count),
                a.updatedAt.slice(0, 10),
            ]));
        }
        catch (err) {
            spinner.stop();
            console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=list.js.map