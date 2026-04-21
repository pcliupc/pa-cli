import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const SKILL_NAMES = ["pa-shared", "pa-agent", "pa-skill", "pa-session"];
export function registerSkillsCommand(program) {
    program
        .command("skills-install")
        .description("Install PA CLI skills to the current project's .claude/skills/ directory")
        .option("--dir <path>", "Target directory (default: .claude/skills/ in current directory)")
        .action((options) => {
        const targetDir = options.dir
            ? path.resolve(options.dir)
            : path.resolve(process.cwd(), ".claude", "skills");
        // Find the skills directory bundled with this CLI
        const cliRoot = path.dirname(fileURLToPath(import.meta.url));
        // In dev: src/commands/skills-install.ts -> ../../skills/
        // In prod: dist/commands/skills-install.js -> ../../skills/
        const skillsSource = path.resolve(cliRoot, "..", "..", "skills");
        if (!fs.existsSync(skillsSource)) {
            console.error(chalk.red("Error: Skills directory not found. Re-install pa-cli."));
            process.exit(1);
        }
        fs.mkdirSync(targetDir, { recursive: true });
        let installed = 0;
        for (const name of SKILL_NAMES) {
            const srcDir = path.join(skillsSource, name);
            const srcFile = path.join(srcDir, "SKILL.md");
            if (!fs.existsSync(srcFile)) {
                console.warn(chalk.yellow(`Warning: Skill "${name}" not found, skipping.`));
                continue;
            }
            const destDir = path.join(targetDir, name);
            fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(srcFile, path.join(destDir, "SKILL.md"));
            installed++;
        }
        console.log(chalk.green(`✓ Installed ${installed} skills to ${targetDir}`));
        console.log(chalk.gray(`\nSkills installed. Restart Claude Code to load them.`));
    });
}
//# sourceMappingURL=skills-install.js.map