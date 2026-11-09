import type { Snapshot } from '../model';
import { emptySnapshot, snapshotsEqual, validateSnapshot } from '../model';
import { mergeSnapshots } from '../merge';
import type { ServerConfig } from './config';
import { HttpError } from './http';

type Fetcher = typeof fetch;
type Remote = { snapshot: Snapshot; revision: string | null };
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_BASE64 = Math.ceil(MAX_BYTES / 3) * 4;
const MAX_RESPONSE_BYTES = MAX_BASE64 + Math.ceil(MAX_BASE64 / 60) * 2 + 64 * 1024;
const validSha = (value: unknown): value is string => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const validSize = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_BYTES;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

async function readJson(response: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new HttpError(413, 'The GitHub response is too large.');
  if (!response.body) throw new HttpError(502, 'GitHub returned an invalid response. Try again later.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, 'The GitHub response is too large.');
      }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'GitHub returned an invalid response. Try again later.');
  } finally { reader.releaseLock(); }
}

function decodeSnapshot(content: unknown): Snapshot {
  if (typeof content !== 'string') throw new HttpError(422, 'The library.json file on GitHub is invalid. No data was overwritten.');
  if (content.length > MAX_RESPONSE_BYTES) throw new HttpError(413, 'The GitHub file is too large.');
  const encoded = content.replace(/[ \t\r\n]/g, '');
  if (encoded.length > MAX_BASE64) throw new HttpError(413, 'The GitHub file is too large.');
  if (encoded.length % 4 || !/^[a-z\d+/]*={0,2}$/i.test(encoded)) throw new HttpError(422, 'The library.json file on GitHub is invalid. No data was overwritten.');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.byteLength > MAX_BYTES) throw new HttpError(413, 'The GitHub file is too large.');
  try {
    if (bytes.toString('base64') !== encoded) throw new Error('Invalid base64');
    return validateSnapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { throw new HttpError(422, 'The library.json file on GitHub is invalid. No data was overwritten.'); }
}

export class GitHubStore {
  constructor(private config: ServerConfig, private fetcher: Fetcher = fetch) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.fetcher(`https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}${path}`, {
        ...init,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.config.token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...init.headers },
        cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(20000),
      });
    } catch { throw new HttpError(502, 'GitHub is unreachable. Try again; your changes are preserved on this device.'); }
  }

  private fail(status: number): never {
    if (status === 401 || status === 403 || status === 429) throw new HttpError(503, 'GitHub access denied or rate limit reached. Check the token and repository permissions.');
    if (status === 404) throw new HttpError(503, 'GitHub repository is inaccessible. Check its configuration and initialize it with a README.');
    throw new HttpError(502, 'GitHub could not save the data. Try again later.');
  }

  async read(): Promise<Remote> {
    // A missing file must not conceal an inaccessible or accidentally public repository.
    const repo = await this.request('');
    if (!repo.ok) this.fail(repo.status);
    const metadata = await readJson(repo, 64 * 1024);
    if (!record(metadata) || metadata.private !== true) throw new HttpError(503, 'The data repository must be private before synchronizing.');
    const branch = await this.request(`/git/ref/heads/${encodeURIComponent(this.config.branch)}`);
    if (branch.status === 404 || branch.status === 409) throw new HttpError(503, 'GitHub branch not found. Initialize the repository with a README and check the branch name.');
    if (!branch.ok) this.fail(branch.status);
    const reference = await readJson(branch, 64 * 1024);
    if (!record(reference) || reference.ref !== `refs/heads/${this.config.branch}` || !record(reference.object) || !validSha(reference.object.sha)) throw new HttpError(502, 'GitHub returned an invalid branch reference.');
    const response = await this.request(`/contents/library.json?ref=${encodeURIComponent(this.config.branch)}`);
    if (response.status === 404) return { snapshot: emptySnapshot(), revision: null };
    if (!response.ok) this.fail(response.status);
    const file = await readJson(response);
    if (!record(file) || file.type !== 'file' || !validSha(file.sha) || !validSize(file.size)) throw new HttpError(413, 'The GitHub file is invalid or too large.');
    let content: unknown = file.content;
    if (file.encoding !== 'base64' || content === '' || content == null) {
      const blob = await this.request(`/git/blobs/${file.sha}`);
      if (!blob.ok) this.fail(blob.status);
      const payload = await readJson(blob);
      if (!record(payload) || payload.encoding !== 'base64' || !validSize(payload.size)) throw new HttpError(413, 'The GitHub file is invalid or too large.');
      content = payload.content;
    }
    return { snapshot: decodeSnapshot(content), revision: file.sha };
  }

  async synchronize(base: Snapshot, local: Snapshot) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await this.read();
      let merged: ReturnType<typeof mergeSnapshots>;
      try { merged = mergeSnapshots(base, local, remote.snapshot); }
      catch { throw new HttpError(409, 'The combined changes are incompatible. Check the decks and cards before trying again. Your data is preserved.'); }
      if (merged.conflicts.length) return { conflict: true as const, snapshot: merged.snapshot, remote: remote.snapshot, conflicts: merged.conflicts };
      let snapshot: Snapshot;
      try { snapshot = validateSnapshot(merged.snapshot); }
      catch { throw new HttpError(409, 'The combined changes are incompatible. Synchronize, then check the decks and cards.'); }
      if (snapshotsEqual(snapshot, remote.snapshot)) return { conflict: false as const, snapshot, revision: remote.revision, lastSyncedAt: new Date().toISOString() };
      const encoded = JSON.stringify(snapshot, null, 2);
      if (Buffer.byteLength(encoded) > MAX_BYTES) throw new HttpError(413, 'The library exceeds the 4 MB limit for this version. Export your data.');
      const response = await this.request('/contents/library.json', {
        method: 'PUT',
        body: JSON.stringify({ message: '[Codex] Synchronise library', content: Buffer.from(encoded).toString('base64'), branch: this.config.branch, ...(remote.revision ? { sha: remote.revision } : {}) }),
      });
      if (response.status === 409 || response.status === 422) continue;
      if (!response.ok) this.fail(response.status);
      const result = await readJson(response, 64 * 1024);
      if (!record(result) || !record(result.content) || !validSha(result.content.sha)) throw new HttpError(502, 'GitHub returned an invalid save response. Synchronize again to verify your backup.');
      return { conflict: false as const, snapshot, revision: result.content.sha, lastSyncedAt: new Date().toISOString() };
    }
    throw new HttpError(409, 'Another device is synchronizing at the same time. Try again in a few seconds.');
  }
}
