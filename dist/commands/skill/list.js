import ora from "ora";
import { PaApiClient } from "../../lib/api-client.js";
import { loadConfig } from "../../lib/config.js";
import { outputData } from "../../lib/output.js";
export function registerSkillListCommand(skillCmd) {
    skillCmd
        .command("list")
        .description("List all skills")
        .option("--category <category>", "Filter by category")
        .option("--search <keyword>", "Search by keyword")
        .action(async (options) => {
        const config = loadConfig();
        const parentOpts = skillCmd.parent?.parent?.opts?.();
        const serverUrl = parentOpts?.server ?? config.serverUrl;
        const outputFormat = (parentOpts?.output ?? "table");
        const client = new PaApiClient({
            serverUrl,
            apiKey: config.apiKey,
        });
        const spinner = ora("Loading skills...").start();
        try {
            const params = new URLSearchParams();
            if (options.category)
                params.set("category", options.category);
            if (options.search)
                params.set("search", options.search);
            const qs = params.toString();
            const skills = await client.getJson(`/api/skills${qs ? `?${qs}` : ""}`);
            spinner.stop();
            if (skills.length === 0) {
                console.log("No skills found.");
                return;
            }
            outputData(skills, outputFormat, [
                "Name",
                "Display Name",
                "Version",
                "Category",
                "Downloads",
                "Updated",
            ], skills.map((s) => [
                s.name,
                s.displayName,
                s.version,
                s.category,
                String(s.downloads),
                s.updatedAt ? s.updatedAt.slice(0, 10) : "-",
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