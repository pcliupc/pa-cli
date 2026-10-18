import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { PaApiClient } from './api-client.js';

export type TaskAction = 'start' | 'stop' | 'recover' | 'resume' | 'continue_budget';
export interface TaskStatus {
  schemaVersion: 'pa-task-api/v1'; taskId: string; sessionId: string; sessionUrl?: string;
  execution: { status: 'accepted' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'; [key: string]: unknown };
  startup: { state: 'pending' | 'started' | 'blocked'; [key: string]: unknown };
  pendingInteractions: { id: string; [key: string]: unknown }[];
  allowedActions: { action: TaskAction; context: Record<string, unknown> }[];
  [key: string]: unknown;
}
export interface TaskFile { artifactId: string; version: string; checksum: string; fileName: string; mimeType: string; downloadUrl: string }
export interface TaskResultResponse { schemaVersion: string; taskId: string; sessionId: string; result: unknown; files: TaskFile[] }
export type TaskWaitResult = TaskStatus & { waitReason: 'terminal' | 'action_required' | 'timeout' };
const taskPath = (id: string) => `/api/tasks/${encodeURIComponent(id)}`;
// Kept aligned with Web's allowed uploads; the server remains authoritative.
const attachmentTypes: Record<string, string> = {
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.html': 'text/html', '.txt': 'text/plain', '.csv': 'text/csv', '.md': 'text/markdown',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.json': 'application/json',
};
const signalFor = (signal?: AbortSignal) => signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);

/** Task methods preserve server decisions; no implicit retry of a write operation. */
export class TaskClient {
  constructor(private readonly api: PaApiClient) {}
  async submit(request: Record<string, unknown>, files: string[] = []): Promise<unknown> {
    if (!files.length) return this.api.postJson('/api/tasks', request, signalFor());
    if (files.length > 10) throw new Error('A task submission accepts at most 10 files');
    const form = new FormData(); form.append('request', JSON.stringify(request));
    for (const file of files) {
      const stat = fs.statSync(file);
      if (!stat.isFile()) throw new Error(`Attachment is not a file: ${file}`);
      const type = attachmentTypes[path.extname(file).toLowerCase()];
      if (!type) throw new Error(`Unsupported attachment type: ${path.extname(file)}`);
      if (stat.size > 100 * 1024 * 1024) throw new Error(`Attachment exceeds 100 MB: ${path.basename(file)}`);
      const bytes = fs.readFileSync(file);
      form.append('files', new Blob([bytes], { type }), path.basename(file));
    }
    return this.api.postMultipart('/api/tasks', form, signalFor());
  }
  get(id: string, signal?: AbortSignal): Promise<TaskStatus> { return this.api.getJson(taskPath(id), signalFor(signal)); }
  result(id: string): Promise<TaskResultResponse> { return this.api.getJson(`${taskPath(id)}/result`, signalFor()); }
  respond(id: string, interactionId: string, request: Record<string, unknown>): Promise<unknown> {
    return this.api.postJson(`${taskPath(id)}/interactions/${encodeURIComponent(interactionId)}/resolve`, request, signalFor());
  }
  action(id: string, request: Record<string, unknown>): Promise<unknown> { return this.api.postJson(`${taskPath(id)}/actions`, request, signalFor()); }
  async wait(id: string, options: { timeoutSeconds?: number; signal?: AbortSignal } = {}): Promise<TaskWaitResult> {
    const timeout = options.timeoutSeconds ?? 60;
    if (!Number.isFinite(timeout) || timeout < 0) throw new Error('timeout must be a non-negative number of seconds');
    const deadline = Date.now() + timeout * 1000;
    // --timeout 0 requests one snapshot. Otherwise the wait deadline includes HTTP time.
    const deadlineSignal = timeout > 0 ? AbortSignal.timeout(Math.min(2_147_483_647, Math.ceil(timeout * 1000))) : undefined;
    const signals = [options.signal, deadlineSignal].filter((value): value is AbortSignal => Boolean(value));
    const waitSignal = signals.length ? AbortSignal.any(signals) : undefined;
    let interval = 2000;
    let lastStatus: TaskStatus | undefined;
    try {
      while (true) {
        waitSignal?.throwIfAborted();
        const status = await this.get(id, waitSignal);
        lastStatus = status;
        if (['completed', 'failed', 'cancelled'].includes(status.execution.status)) return { ...status, waitReason: 'terminal' };
        if (status.pendingInteractions.length || status.startup.state === 'blocked' || status.allowedActions.some(item => ['start', 'recover', 'resume', 'continue_budget'].includes(item.action))) return { ...status, waitReason: 'action_required' };
        if (Date.now() >= deadline) return { ...status, waitReason: 'timeout' };
        await sleep(Math.min(interval, deadline - Date.now()), undefined, { signal: waitSignal });
        interval = Math.min(5000, interval + 1000);
      }
    } catch (error) {
      if (lastStatus && deadlineSignal?.aborted && !options.signal?.aborted) return { ...lastStatus, waitReason: 'timeout' };
      throw error;
    }
  }

  async download(id: string, files: TaskFile[], directory: string): Promise<string[]> {
    const root = path.resolve(directory);
    const names = new Set<string>();
    for (const file of files) {
      if (!file.fileName || /[/\\\x00-\x1f:]/.test(file.fileName) || ['.', '..'].includes(file.fileName) || path.isAbsolute(file.fileName)) throw new Error('Unsafe result file name');
      const folded = file.fileName.normalize('NFC').toLowerCase();
      if (names.has(folded)) throw new Error('Duplicate result file destination');
      names.add(folded);
      if (!/^(sha256:)?[a-f0-9]{64}$/i.test(file.checksum)) throw new Error('Unsupported result checksum');
    }
    assertNoSymlinks(root);
    fs.mkdirSync(root, { recursive: true });
    for (const file of files) if (fs.existsSync(path.join(root, file.fileName)) || isSymlink(path.join(root, file.fileName))) throw new Error(`Result file already exists: ${file.fileName}`);
    const written: string[] = [];
    for (const file of files) {
      // Construct the same-origin exact-version URL from authorized references, never forward a Key to a supplied URL.
      const query = new URLSearchParams({ version: file.version, checksum: file.checksum });
      const bytes = await this.api.getBytes(`${taskPath(id)}/files/${encodeURIComponent(file.artifactId)}?${query}`, signalFor());
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if (checksum !== file.checksum.replace(/^sha256:/i, '').toLowerCase()) throw new Error(`Result checksum mismatch: ${file.fileName}`);
      assertNoSymlinks(root);
      const target = path.join(root, file.fileName);
      const temporary = path.join(root, `.pa-task-${randomUUID()}.tmp`);
      try {
        fs.writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 });
        // Hard link commits atomically and fails if another writer created the target.
        fs.linkSync(temporary, target);
        written.push(target);
      } finally { fs.rmSync(temporary, { force: true }); }
    }
    return written;
  }
}
function isSymlink(file: string): boolean {
  try { return fs.lstatSync(file).isSymbolicLink(); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
function assertNoSymlinks(directory: string): void {
  // Resolve OS aliases such as macOS /tmp at the root boundary, but reject user-controlled symlink segments.
  let current = directory;
  while (current !== path.dirname(current)) {
    if (isSymlink(current) && !['/tmp', '/var'].includes(current)) throw new Error('Download directory contains a symbolic link');
    current = path.dirname(current);
  }
}
