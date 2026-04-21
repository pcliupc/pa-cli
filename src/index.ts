#!/usr/bin/env node
import fs from "node:fs";
import { Command } from "commander";
import { registerConfigCommand } from "./commands/config.js";
import { registerAgentCommands } from "./commands/agent/index.js";
import { registerSkillCommands } from "./commands/skill/index.js";
import { registerSessionCommands } from "./commands/session/index.js";
import { registerSkillsCommand } from "./commands/skills-install.js";

const packageJson = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

const program = new Command();

program
  .name("pa")
  .description("PA Framework CLI - manage agents and skills")
  .version(packageJson.version)
  .option("--output <format>", "output format: table or json", "table")
  .option("--server <url>", "override server URL");

registerConfigCommand(program);
registerAgentCommands(program);
registerSkillCommands(program);
registerSessionCommands(program);
registerSkillsCommand(program);

program.parse();
