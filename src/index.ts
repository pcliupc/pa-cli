#!/usr/bin/env node
import { Command } from "commander";
import { registerConfigCommand } from "./commands/config.js";

const program = new Command();

program
  .name("pa")
  .description("PA Framework CLI - manage agents and skills")
  .version("0.1.0")
  .option("--output <format>", "output format: table or json", "table")
  .option("--server <url>", "override server URL");

registerConfigCommand(program);

program.parse();
