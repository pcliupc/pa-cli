import { Command } from "commander";
import chalk from "chalk";
import {
  loadConfig,
  setConfigValue,
  maskApiKey,
  listProfiles,
  addProfile,
  removeProfile,
  useProfile,
  getCurrentProfileName,
} from "../lib/config.js";

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("View and manage CLI configuration");

  // Default action: show current profile config
  configCmd.action(() => {
    const profileName = getCurrentProfileName();
    const config = loadConfig();
    if (profileName) {
      console.log(chalk.cyan(`Profile: ${profileName}`));
    }
    console.log(`serverUrl: ${config.serverUrl}`);
    console.log(
      `apiKey:    ${maskApiKey(config.apiKey) || chalk.gray("(not set)")}`,
    );
  });

  // config set <key> <value>
  configCmd
    .command("set")
    .description("Set a configuration value in the active profile")
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

  // config profile subcommand group
  const profileCmd = configCmd
    .command("profile")
    .description("Manage configuration profiles");

  // config profile list
  profileCmd
    .command("list")
    .description("List all configuration profiles")
    .action(() => {
      const profiles = listProfiles();
      const current = getCurrentProfileName();

      if (profiles.length === 0) {
        console.log(chalk.gray("No profiles configured."));
        console.log(
          chalk.gray("Run 'pa config profile add <name>' to create one."),
        );
        return;
      }

      for (const p of profiles) {
        const marker = p.name === current ? chalk.cyan("*") : " ";
        const maskedKey = maskApiKey(p.apiKey) || chalk.gray("(not set)");
        console.log(
          `${marker} ${p.name.padEnd(12)}${p.serverUrl.padEnd(30)}${maskedKey}`,
        );
      }
    });

  // config profile add <name>
  profileCmd
    .command("add")
    .description("Add a new configuration profile")
    .argument("<name>", "Profile name (letters, numbers, hyphens, underscores)")
    .requiredOption("-u, --server-url <url>", "Server URL")
    .requiredOption("-k, --api-key <key>", "API key")
    .action(
      (name: string, opts: { serverUrl: string; apiKey: string }) => {
        try {
          addProfile({
            name,
            serverUrl: opts.serverUrl,
            apiKey: opts.apiKey,
          });
          console.log(chalk.green(`✓ Profile "${name}" added.`));

          const current = getCurrentProfileName();
          if (current === name) {
            console.log(
              chalk.gray(
                `  (automatically set as active — this was your first profile)`,
              ),
            );
          }
        } catch (err) {
          console.error(
            chalk.red(
              `Error: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exit(1);
        }
      },
    );

  // config profile remove <name>
  profileCmd
    .command("remove")
    .description("Remove a configuration profile")
    .argument("<name>", "Profile name to remove")
    .action((name: string) => {
      try {
        removeProfile(name);
        console.log(chalk.green(`✓ Profile "${name}" removed.`));
      } catch (err) {
        console.error(
          chalk.red(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }
    });

  // config use <name>
  configCmd
    .command("use")
    .description("Switch the active configuration profile")
    .argument("<name>", "Profile name to activate")
    .action((name: string) => {
      try {
        const config = useProfile(name);
        console.log(
          chalk.green(
            `Switched to profile "${name}" (${config.serverUrl})`,
          ),
        );
      } catch (err) {
        console.error(
          chalk.red(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }
    });
}
