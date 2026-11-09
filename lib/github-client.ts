import { emptySnapshot, snapshotsEqual, validateSnapshot, type Snapshot } from './model';
import { mergeSnapshots, type Conflict } from './merge';

export type GitHubConfig = { owner: string; repo: string; branch: string; token: string };
export type GitHubRemote = { snapshot: Snapshot; revision: string | null };
export type GitHubSyncResult =
  | { conflict: false; snapshot: Snapshot; revision: string | null; lastSyncedAt: string }
  | { conflict: true; snapshot: Snapshot; remote: Snapshot; conflicts: Conflict[] };

type Fetcher = typeof fetch;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_BASE64 = Math.ceil(MAX_BYTES / 3) * 4 + 10000;

export function parseRepository(input: string): { owner: string; repo: string } {
  let path = input.trim();
  if (/^https?:\/\//i.test(path)) {
    let url: URL;
    try { url = new URL(path); } catch { throw new Error('Enter a GitHub repository in owner/repository format.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('Use a URL in https://github.com/owner/repository format.');
    path = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  }
  const parts = path.replace(/\.git$/, '').split('/');
  if (parts.length !== 2 || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(parts[0]) || !/^[a-z\d_.-]{1,100}$/i.test(parts[1]) || ['.', '..'].includes(parts[1])) throw new Error('Enter a GitHub repository in owner/repository format.');
  return { owner: parts[0], repo: parts[1] };
}

export function validateGitHubConfig(config: GitHubConfig): GitHubConfig {
  const repo = parseRepository(`${config.owner}/${config.repo}`);
  const branch = config.branch.trim() || 'main';
  const token = config.token.trim();
  if (!token || token.length > 1024 || /\s/.test(token)) throw new Error('Enter a valid GitHub token.');
  if (branch.length > 255 || /[\x00-\x20\x7f]/.test(branch) || branch.startsWith('/') || branch.endsWith('/') || branch.includes('..')) throw new Error('The branch name is invalid.');
  return { ...repo, branch, token };
}

function encodeContent(text: string): string {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > MAX_BYTES) throw new Error('The library exceeds the 4 MB synchronization limit. Export a backup.');
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}

function decodeSnapshot(content: unknown): Snapshot {
  if (typeof content !== 'string' || content.length > MAX_BASE64) throw new Error('The library.json file is too large.');
  try {
    const binary = atob(content.replace(/\s/g, ''));
    if (binary.length > MAX_BYTES) throw new Error('size');
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return validateSnapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { throw new Error('The library.json file on GitHub is invalid. No data was replaced.'); }
}

export class GitHubAuthenticationError extends Error {
  constructor() { super('GitHub token rejected or expired. Reconnect in Settings.'); this.name = 'GitHubAuthenticationError'; }
}

function fail(status: number): never {
  if (status === 401) throw new GitHubAuthenticationError();
  if (status === 403 || status === 429) throw new Error('GitHub access denied or rate limit reached. Check the Contents read and write permissions.');
  if (status === 404) throw new Error('Repository not found or inaccessible with this token.');
  throw new Error('GitHub is temporarily unavailable. Your local data is preserved.');
}

/** Personal direct mode sends credentials only to GitHub.
 * Browser connection storage is separate from library data and exports.
 */
export class GitHubClient {
  private config: GitHubConfig;
  constructor(config: GitHubConfig, private fetcher: Fetcher = (input, init) => globalThis.fetch(input, init)) { this.config = validateGitHubConfig(config); }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}${path}`;
    try {
      return await this.fetcher(url, {
        ...init,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.config.token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
        cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(20000),
      });
    } catch { throw new Error('GitHub is unreachable. Check your connection; your local data is preserved.'); }
  }

  async read(): Promise<GitHubRemote> {
    const repoResponse = await this.request('');
    if (!repoResponse.ok) fail(repoResponse.status);
    const metadata = await repoResponse.json();
    if (metadata.private !== true) throw new Error('The data repository must be private.');

    // A wrong or uninitialized branch must never look like a new empty library.
    const branch = await this.request(`/git/ref/heads/${encodeURIComponent(this.config.branch)}`);
    if (branch.status === 404 || branch.status === 409) throw new Error('Branch not found. Initialize the repository with a README and check the branch name.');
    if (!branch.ok) fail(branch.status);

    const response = await this.request(`/contents/library.json?ref=${encodeURIComponent(this.config.branch)}`);
    if (response.status === 404) return { snapshot: emptySnapshot(), revision: null };
    if (!response.ok) fail(response.status);
    const file = await response.json();
    if (file.type !== 'file' || typeof file.sha !== 'string' || !/^[a-f0-9]{40,64}$/.test(file.sha) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_BYTES) throw new Error('The library.json file is invalid or exceeds 4 MB.');
    let content: unknown = file.content;
    if (file.encoding !== 'base64' || !content) {
      const blob = await this.request(`/git/blobs/${file.sha}`);
      if (!blob.ok) fail(blob.status);
      const payload = await blob.json();
      if (payload.encoding !== 'base64' || !Number.isSafeInteger(payload.size) || payload.size < 0 || payload.size > MAX_BYTES) throw new Error('The library.json file is too large.');
      content = payload.content;
    }
    return { snapshot: decodeSnapshot(content), revision: file.sha };
  }

  async synchronize(baseInput: Snapshot, localInput: Snapshot): Promise<GitHubSyncResult> {
    const base = validateSnapshot(baseInput), local = validateSnapshot(localInput);
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await this.read();
      let merged: ReturnType<typeof mergeSnapshots>;
      try { merged = mergeSnapshots(base, local, remote.snapshot); }
      catch { throw new Error('The changes are incompatible. Check the decks and cards before synchronizing.'); }
      if (merged.conflicts.length) return { conflict: true, snapshot: merged.snapshot, remote: remote.snapshot, conflicts: merged.conflicts };
      const snapshot = validateSnapshot(merged.snapshot);
      if (snapshotsEqual(snapshot, remote.snapshot)) return { conflict: false, snapshot, revision: remote.revision, lastSyncedAt: new Date().toISOString() };
      const response = await this.request('/contents/library.json', {
        method: 'PUT',
        body: JSON.stringify({ message: '[Codex] Synchronise library', content: encodeContent(JSON.stringify(snapshot, null, 2)), branch: this.config.branch, ...(remote.revision ? { sha: remote.revision } : {}) }),
      });
      if (response.status === 409 || response.status === 422) continue;
      if (!response.ok) fail(response.status);
      const result = await response.json();
      if (typeof result.content?.sha !== 'string') throw new Error('Unexpected GitHub response. Synchronize again to verify the backup.');
      return { conflict: false, snapshot, revision: result.content.sha, lastSyncedAt: new Date().toISOString() };
    }
    throw new Error('Another device is synchronizing at the same time. Try again in a few seconds.');
  }
}

export const readGitHub = (config: GitHubConfig, fetcher?: Fetcher) => new GitHubClient(config, fetcher).read();
export const syncGitHub = (config: GitHubConfig, base: Snapshot, local: Snapshot, fetcher?: Fetcher) => new GitHubClient(config, fetcher).synchronize(base, local);
