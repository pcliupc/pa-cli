import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/lib/config.js', () => ({ loadConfig: () => ({ serverUrl: 'https://default.test', apiKey: 'personal-secret' }), loadProfile: (name: string) => {
  if (name !== 'dev') throw new Error('Unknown profile');
  return { serverUrl: 'https://dev.test', apiKey: 'dev-secret' };
} }));
let root: string; let stdout: ReturnType<typeof vi.spyOn>; let stderr: ReturnType<typeof vi.spyOn>;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-task-command-')); stdout = vi.spyOn(console, 'log').mockImplementation(() => {}); stderr = vi.spyOn(console, 'error').mockImplementation(() => {}); process.exitCode = 0; });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); vi.restoreAllMocks(); vi.unstubAllGlobals(); process.exitCode = 0; });
async function run(args: string[]) {
  const { registerTaskCommands } = await import('../../src/commands/task/index.js');
  const program = new Command().exitOverride().option('--output <format>', '', 'table').option('--server <url>');
  registerTaskCommands(program);
  await program.parseAsync(['--output', 'json', 'task', ...args], { from: 'user' });
}
function request(data: unknown) { const file = path.join(root, 'request.json'); fs.writeFileSync(file, JSON.stringify(data)); return file; }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const state = { schemaVersion: 'pa-task-api/v1', taskId: 't', sessionId: 's', execution: { status: 'running' }, startup: { state: 'started' }, pendingInteractions: [], allowedActions: [] };

describe('pa task commands', () => {
  it('submits envelope with explicit key and profile, printing exactly one JSON value', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      expect(url).toBe('https://dev.test/api/tasks');
      expect(init.headers.Authorization).toBe('Bearer dev-secret');
      expect(JSON.parse(init.body)).toMatchObject({ agentId: 'a', spaceId: 's', idempotencyKey: 'business-1', taskEnvelope: { objective: 'Test' } });
      return json({ taskId: 't', sessionUrl: '/pa/session/s' }, 202);
    }));
    await run(['submit', '--profile', 'dev', '--agent', 'a', '--space', 's', '--idempotency-key', 'business-1', '--request', request({ objective: 'Test', definitionOfDone: ['Done'] })]);
    expect(stdout).toHaveBeenCalledTimes(1); expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({ taskId: 't' }); expect(stderr).not.toHaveBeenCalled();
  });
  it('preserves task id and submission key on a failed request without logging credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'failed', errorCode: 'task_upload_failed', errorKey: 'taskUploadFailed', details: { taskId: 'saved-task', sessionId: 'saved-session' } }, 503)));
    await run(['submit', '--agent', 'a', '--space', 's', '--idempotency-key', 'business-1', '--request', request({ objective: 'Test', definitionOfDone: ['Done'] })]);
    expect(process.exitCode).toBe(1); expect(stdout).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({ error: { status: 503, errorCode: 'task_upload_failed', errorKey: 'taskUploadFailed', taskId: 'saved-task', sessionId: 'saved-session', idempotencyKey: 'business-1' } });
    expect(JSON.stringify(stdout.mock.calls)).not.toContain('personal-secret');
  });
  it('does not retry an ambiguous submission timeout and retains its key', async () => {
    const fetch = vi.fn(async () => { throw new DOMException('Request timed out', 'TimeoutError'); }); vi.stubGlobal('fetch', fetch);
    await run(['submit', '--agent', 'a', '--space', 's', '--idempotency-key', 'business-timeout', '--request', request({ objective: 'Test', definitionOfDone: ['Done'] })]);
    expect(fetch).toHaveBeenCalledTimes(1); expect(process.exitCode).toBe(1);
    expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({ error: { idempotencyKey: 'business-timeout', retry: expect.stringContaining('same idempotency key') } });
  });
  it('timeout keeps task identity and a zero exit code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(state)));
    await run(['wait', 't', '--timeout', '0']);
    expect(process.exitCode).toBe(0); expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({ taskId: 't', waitReason: 'timeout' });
  });
  it('respond forwards an exact decision body without an extra pending lookup', async () => {
    const body = { resolution: { answer: 'yes', parameterHash: 'h', decisionScope: 'single_request' }, basis: 'User said yes' };
    const fetch = vi.fn(async (_url, init) => { expect(init.method).toBe('POST'); expect(JSON.parse(init.body)).toEqual(body); return json({ resolved: true }); }); vi.stubGlobal('fetch', fetch);
    await run(['respond', 't', '--interaction', 'q', '--request', request(body)]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('reads exact budget context only on an explicit continue-budget command', async () => {
    const fetch = vi.fn(async (_url, init) => {
      if (init.method === 'GET') return json({ ...state, allowedActions: [{ action: 'continue_budget', context: { runtimeGeneration: 2, budgetRevision: '3' } }] });
      expect(JSON.parse(init.body)).toEqual({ action: 'continue_budget', commandId: 'decision-1', runtimeGeneration: 2, budgetRevision: '3' }); return json({ accepted: true });
    }); vi.stubGlobal('fetch', fetch);
    await run(['continue-budget', 't', '--command-id', 'decision-1']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('allows exact-context retry without reinterpreting a new state', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { expect(init.method).toBe('POST'); expect(JSON.parse(init.body)).toEqual({ action: 'stop', commandId: 'stop-1', turnId: 'turn-1', runtimeGeneration: 2 }); return json({ accepted: true }); }));
    await run(['stop', 't', '--command-id', 'stop-1', '--request', request({ turnId: 'turn-1', runtimeGeneration: 2 })]); expect(process.exitCode).toBe(0);
  });
  it('start uses the fixed startup command from server context', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (init.method === 'GET') return json({ ...state, allowedActions: [{ action: 'start', context: { commandId: 'task-api:t:initial-start' } }] });
      expect(JSON.parse(init.body).commandId).toBe('task-api:t:initial-start'); return json({ accepted: true });
    }));
    await run(['start', 't']); expect(process.exitCode).toBe(0);
  });
  it('SIGINT exits only the waiting CLI with code 130', async () => {
    const fetch = vi.fn(async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      setImmediate(() => process.emit('SIGINT'));
    })); vi.stubGlobal('fetch', fetch);
    await run(['wait', 't']); expect(process.exitCode).toBe(130); expect(fetch).toHaveBeenCalledTimes(1);
  });
});
