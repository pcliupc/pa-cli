import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaApiClient } from '../../src/lib/api-client.js';

const roots: string[] = [];
const tmp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-task-')); roots.push(dir); return dir; };
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); vi.restoreAllMocks(); });
const status = (state = 'running', extra = {}) => ({ schemaVersion: 'pa-task-api/v1', taskId: 'run-1', sessionId: 's-1', execution: { status: state }, startup: { state: 'started' }, pendingInteractions: [], allowedActions: [], ...extra });
async function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const { TaskClient } = await import('../../src/lib/task-client.js');
  return new TaskClient(new PaApiClient({ serverUrl: 'https://pa.test', apiKey: 'secret', fetch: (url, init) => Promise.resolve(handler(String(url), init!)) }));
}
const json = (data: unknown, code = 200) => new Response(JSON.stringify(data), { status: code });

describe('task API transport', () => {
  it('preserves a submitted key and sends repeated files with request JSON', async () => {
    const dir = tmp(); fs.writeFileSync(path.join(dir, 'a.md'), '证据');
    const submitted: any[] = [];
    const client = await setup((url, init) => { expect(url).toBe('https://pa.test/api/tasks'); submitted.push(init.body); return json({ taskId: 'run-1' }, 202); });
    const request = { agentId: 'pa-1', spaceId: 'space-1', idempotencyKey: 'business-42', taskEnvelope: { objective: '分析', definitionOfDone: ['输出结果'] } };
    await client.submit(request, [path.join(dir, 'a.md')]); await client.submit(request, []);
    expect(JSON.parse(submitted[0].get('request'))).toEqual(request);
    expect(await submitted[0].get('files').text()).toBe('证据');
    expect(submitted[0].get('files').type).toBe('text/markdown');
    expect(await new Request('https://pa.test/api/tasks', { method: 'POST', body: submitted[0] }).text()).toContain('Content-Type: text/markdown');
    expect(JSON.parse(submitted[1]).idempotencyKey).toBe('business-42');
  });
  it('rejects unsupported attachment types and count before sending any request', async () => {
    const dir = tmp(); const file = path.join(dir, 'archive.zip'); fs.writeFileSync(file, 'x');
    const client = await setup(() => { throw new Error('must not fetch'); });
    await expect(client.submit({}, [file])).rejects.toThrow(/Unsupported attachment type/);
    await expect(client.submit({}, Array(11).fill(file))).rejects.toThrow(/10 files/);
  });
  it('preserves structured API errors', async () => {
    const client = await setup(() => json({ error: 'Stale action', errorCode: 'task_action_stale', errorKey: 'taskActionStale' }, 409));
    await expect(client.get('run-1')).rejects.toMatchObject({ status: 409, errorCode: 'task_action_stale', errorKey: 'taskActionStale' });
  });
  it('posts explicit decision unchanged even for an idempotent retry', async () => {
    const body = { resolution: { answer: { approved: false }, parameterHash: 'hash', decisionScope: 'single_request' }, basis: 'Denied by user' };
    const client = await setup((url, init) => { expect(url).toContain('/interactions/question-1/resolve'); expect(JSON.parse(String(init.body))).toEqual(body); return json({ status: 'resolved' }); });
    await client.respond('run-1', 'question-1', body);
  });
});

describe('bounded task polling', () => {
  it.each(['completed', 'failed', 'cancelled'])('returns terminal %s without treating it as a CLI failure', async state => {
    const client = await setup(() => json(status(state)));
    const result = await client.wait('run-1', { timeoutSeconds: 0 });
    expect(result.waitReason).toBe('terminal'); expect(result.taskId).toBe('run-1');
  });
  it('returns on questions and recovery or budget actions without deciding them', async () => {
    for (const extra of [{ pendingInteractions: [{ id: 'q' }] }, { allowedActions: [{ action: 'continue_budget', context: {} }] }, { startup: { state: 'blocked' } }]) {
      const client = await setup(() => json(status('waiting', extra)));
      expect((await client.wait('run-1', { timeoutSeconds: 0 })).waitReason).toBe('action_required');
    }
  });
  it.each([
    ['resume', 'user_stopped'],
    ['continue_budget', 'run_budget_exhausted'],
    ['recover', 'verification_required'],
  ])('returns %s pauses as action_required instead of terminal failure', async (action, failureCode) => {
    let calls = 0;
    const client = await setup((_url, init) => {
      calls++; expect(init.method).toBe('GET');
      return json(status('waiting', {
        execution: { status: 'waiting', sourceStatus: 'active', failureCode },
        allowedActions: [{ action, context: { runtimeGeneration: 1 } }],
      }));
    });
    expect(await client.wait('run-1', { timeoutSeconds: 60 })).toMatchObject({
      taskId: 'run-1', execution: { status: 'waiting', failureCode }, waitReason: 'action_required',
    });
    expect(calls).toBe(1);
  });
  it('timeout retains task identity and does not issue a control request', async () => {
    const client = await setup((_url, init) => { expect(init.method).toBe('GET'); return json(status()); });
    expect(await client.wait('run-1', { timeoutSeconds: 0 })).toMatchObject({ taskId: 'run-1', waitReason: 'timeout' });
  });
  it('stops at the wait deadline even while the next HTTP request is pending', async () => {
    let calls = 0;
    const client = await setup((_url, init) => {
      if (++calls === 1) return json(status());
      return new Promise<Response>((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true }));
    });
    const started = Date.now();
    const result = await client.wait('run-1', { timeoutSeconds: 2.05 });
    expect(result.waitReason).toBe('timeout'); expect(calls).toBe(2);
    expect(Date.now() - started).toBeLessThan(2900);
  }, 3500);
  it('interrupt aborts the request without stopping the task', async () => {
    const abort = new AbortController(); abort.abort();
    const client = await setup(() => { throw new Error('should not request'); });
    await expect(client.wait('run-1', { signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('verified result downloads', () => {
  const bytes = Buffer.from('保存 Unicode 内容');
  const file = { artifactId: 'artifact-1', version: '1', checksum: createHash('sha256').update(bytes).digest('hex'), fileName: 'report.md', mimeType: 'text/markdown', downloadUrl: '/api/tasks/run-1/files/artifact-1?version=1' };
  it('downloads exact references and verifies SHA-256 before publishing file', async () => {
    const client = await setup((url) => { expect(url).toContain('checksum=' + file.checksum); return new Response(bytes); });
    const dir = tmp(); await client.download('run-1', [file], dir);
    expect(fs.readFileSync(path.join(dir, 'report.md'))).toEqual(bytes);
  });
  it('does not overwrite or leave a corrupt file on checksum mismatch', async () => {
    const client = await setup(() => new Response('corrupt')); const dir = tmp();
    await expect(client.download('run-1', [file], dir)).rejects.toThrow(/checksum/i);
    expect(fs.readdirSync(dir)).toEqual([]);
    fs.writeFileSync(path.join(dir, file.fileName), 'original');
    await expect(client.download('run-1', [file], dir)).rejects.toThrow(/exists/i);
    expect(fs.readFileSync(path.join(dir, file.fileName), 'utf8')).toBe('original');
  });
  it('rejects traversal, duplicate destinations, absolute names and symlink roots', async () => {
    const client = await setup(() => { throw new Error('must not fetch'); }); const dir = tmp();
    for (const name of ['../bad', '/tmp/bad', 'nested/report.md', 'C:\\bad', '..']) await expect(client.download('run-1', [{ ...file, fileName: name }], dir)).rejects.toThrow(/file name/i);
    await expect(client.download('run-1', [file, file], dir)).rejects.toThrow(/duplicate/i);
    const link = path.join(dir, 'linked'); fs.symlinkSync(tmp(), link);
    await expect(client.download('run-1', [file], link)).rejects.toThrow(/symbolic link/i);
  });
});
