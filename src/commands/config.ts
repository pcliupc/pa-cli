import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, setConfigValue, maskApiKey } from "../lib/config.js";

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("View and manage CLI configuration");

  configCmd
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "Config key (serverUrl or apiKey)")
    .argument("<value>", "Config value")
    .action((key: string, value: string) => {
      try {
        setConfigValue(key, value);
        console.log(chalk.green(`✓ Config updated: ${key}`));
      } catch (err) {
        console.error(
          chalk.red(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }
    });

  configCmd.action(() => {
    const config = loadConfig();
    console.log(`serverUrl: ${config.serverUrl}`);
    console.log(`apiKey:    ${maskApiKey(config.apiKey) || chalk.gray("(not set)")}`);
  });
}
