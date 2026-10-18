import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Command } from "commander";

const EXPECTED_SKILLS = [
  "pa-shared",
  "pa-agent",
  "pa-skill",
  "pa-session",
  "pa-space",
  "pa-mcp",
  "pa-example",
  "pa-task",
];

async function runSkillsInstall(argv: string[]) {
  const { registerSkillsCommand } = await import(
    "../../src/commands/skills-install.js"
  );

  const program = new Command();
  program.exitOverride();
  registerSkillsCommand(program);

  await program.parseAsync(argv, { from: "user" });
}

describe("skills-install command", () => {
  it("installs all bundled skills including pa-example", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-skills-install-"));
    const targetDir = path.join(rootDir, ".agents", "skills");

    await runSkillsInstall(["skills-install", "--dir", targetDir]);

    const installedSkillDirs = fs.readdirSync(targetDir).sort();
    expect(installedSkillDirs).toEqual([...EXPECTED_SKILLS].sort());

    for (const skillName of EXPECTED_SKILLS) {
      const skillFilePath = path.join(targetDir, skillName, "SKILL.md");
      expect(fs.existsSync(skillFilePath)).toBe(true);
    }

    const paExampleSkill = fs.readFileSync(
      path.join(targetDir, "pa-example", "SKILL.md"),
      "utf8",
    );
    expect(paExampleSkill).toContain("name: pa-example");

    fs.rmSync(rootDir, { recursive: true, force: true });
  });
});
