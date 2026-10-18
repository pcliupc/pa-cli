import fs from 'node:fs';
import { Command } from 'commander';
import { ApiError, PaApiClient } from '../../lib/api-client.js';
import { loadConfig, loadProfile } from '../../lib/config.js';
import { TaskClient, type TaskAction } from '../../lib/task-client.js';

function readObject(file: string): Record<string, unknown> {
  const data: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Request file must contain a JSON object');
  return data as Record<string, unknown>;
}

export function registerTaskCommands(program: Command): void {
  const task = program.command('task').description('Submit and control ordinary PA tasks');
  // Every task command owns its profile option, so --profile works after the command name.
  const command = (name: string, description: string) => task.command(name).description(description).option('--profile <name>', 'Use a profile for this command without changing the default');
  async function execute(cmd: Command, work: (client: TaskClient) => Promise<unknown>, details: Record<string, unknown> = {}): Promise<void> {
    const options = cmd.optsWithGlobals();
    let key = '';
    const redact = (value: string) => key ? value.split(key).join('[redacted]') : value;
    try {
      if (!['table', 'json'].includes(options.output ?? 'table')) throw new Error('output must be table or json');
      const config = options.profile ? loadProfile(options.profile) : loadConfig();
      key = config.apiKey;
      if (!key) throw new Error('Configure a personal API Key with pa config before using tasks');
      const client = new TaskClient(new PaApiClient({ serverUrl: options.server ?? config.serverUrl, apiKey: key }));
      const result = await work(client);
      // JSON mode writes a single document. No spinner, progress lines, or credentials go to stdout.
      console.log(redact(JSON.stringify(result, null, 2)));
    } catch (error) {
      const interrupted = error instanceof Error && error.name === 'AbortError';
      process.exitCode = interrupted ? 130 : 1;
      const message = redact(error instanceof Error ? error.message : String(error));
      const data = {
        ...details,
        message: interrupted ? 'Stopped waiting. The task has not been stopped.' : message,
        ...(error instanceof ApiError ? { status: error.status, errorCode: error.errorCode, errorKey: error.errorKey, ...(error.taskId ? { taskId: error.taskId } : {}), ...(error.sessionId ? { sessionId: error.sessionId } : {}) } : {}),
        ...(details.idempotencyKey ? { retry: 'Retry the same submission with the same idempotency key and unchanged request/files. Do not create a new key.' } : {}),
      };
      if (options.output === 'json') console.log(redact(JSON.stringify({ error: data }, null, 2)));
      else console.error(redact(JSON.stringify({ error: data }, null, 2)));
    }
  }
  command('submit', 'Submit task parameters and optional attachments in one request')
    .requiredOption('--agent <id>', 'Ordinary PA ID')
    .requiredOption('--space <id>', 'Space ID')
    .requiredOption('--request <file>', 'TaskEnvelope JSON file')
    .requiredOption('--idempotency-key <key>', 'Stable business submission key; reuse on retry')
    .option('--version <id>', 'Agent version ID; defaults to current published version')
    .option('--file <path>', 'Attach a file (repeatable)', (value: string, previous: string[]) => [...previous, value], [])
    .action(async (options, cmd) => execute(cmd, client => client.submit({
      agentId: options.agent, spaceId: options.space, ...(options.version ? { agentVersionId: options.version } : {}),
      idempotencyKey: options.idempotencyKey, taskEnvelope: readObject(options.request),
    }, options.file), { idempotencyKey: options.idempotencyKey, profile: options.profile }));
  command('get <taskId>', 'Read task status, pending decisions, and allowed actions')
    .action(async (taskId, _options, cmd) => execute(cmd, client => client.get(taskId), { taskId }));
  command('wait <taskId>', 'Poll until terminal, action required, or timeout; never stop the task')
    .option('--timeout <seconds>', 'Maximum polling duration in seconds', '60')
    .action(async (taskId, options, cmd) => {
      const controller = new AbortController();
      const interrupt = () => controller.abort();
      process.once('SIGINT', interrupt);
      try { await execute(cmd, client => client.wait(taskId, { timeoutSeconds: Number(options.timeout), signal: controller.signal }), { taskId }); }
      finally { process.removeListener('SIGINT', interrupt); }
    });
  command('respond <taskId>', 'Submit an explicit answer, approval, or confirmation')
    .requiredOption('--interaction <id>', 'Exact pending interaction ID')
    .requiredOption('--request <file>', 'JSON with resolution (answer, parameterHash, decisionScope) and basis')
    .action(async (taskId, options, cmd) => execute(cmd, client => client.respond(taskId, options.interaction, readObject(options.request)), { taskId, interactionId: options.interaction }));
  command('result <taskId>', 'Read the verified final result and optionally download its files')
    .option('--download-dir <directory>', 'Download exact file versions, verify checksums, never overwrite')
    .action(async (taskId, options, cmd) => execute(cmd, async client => {
      const result = await client.result(taskId);
      return options.downloadDir ? { ...result, downloadedFiles: await client.download(taskId, result.files, options.downloadDir) } : result;
    }, { taskId }));
  for (const action of ['start', 'stop', 'recover', 'resume', 'continue_budget'] as TaskAction[]) {
    const control = command(`${action.replace('_', '-')} <taskId>`, `${action.replace('_', ' ')} using exact server-issued action context`)
      .option('--request <file>', 'Saved action context/body for an exact retry (no fresh status lookup)')
      .option('--message <text>', 'Explicit continuation instruction (resume / continue-budget only)');
    if (action === 'start') control.option('--command-id <id>', 'Must equal the fixed startup command ID');
    else control.requiredOption('--command-id <id>', 'Stable ID for this decision; reuse with the same context on retry');
    control.action(async (taskId, options, cmd) => execute(cmd, async client => {
      if (options.message && !['resume', 'continue_budget'].includes(action)) throw new Error('--message applies only to resume or continue-budget');
      const context = options.request ? readObject(options.request) : (await client.get(taskId)).allowedActions.find(item => item.action === action)?.context;
      if (!context) throw new Error(`Action ${action} is not currently allowed; inspect pa task get ${taskId}`);
      if (context.action !== undefined && context.action !== action) throw new Error('Request action does not match command');
      if (context.commandId !== undefined && options.commandId && context.commandId !== options.commandId) throw new Error('Command ID does not match saved context');
      const commandId = options.commandId ?? context.commandId;
      if (!commandId) throw new Error('The server did not provide a startup command ID');
      return client.action(taskId, { ...context, action, commandId, ...(options.message ? { message: options.message } : {}) });
    }, { taskId, commandId: options.commandId }));
  }
}
