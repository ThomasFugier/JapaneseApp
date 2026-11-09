import type { Snapshot } from '../model';
import { emptySnapshot, snapshotsEqual, validateSnapshot } from '../model';
import { mergeSnapshots } from '../merge';
import type { ServerConfig } from './config';
import { HttpError } from './http';

type Fetcher = typeof fetch;
type Remote = { snapshot: Snapshot; revision: string | null };
const MAX_BYTES = 4 * 1024 * 1024;

export class GitHubStore {
  constructor(private config: ServerConfig, private fetcher: Fetcher = fetch) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.fetcher(`https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}${path}`, {
        ...init,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.config.token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...init.headers },
        cache: 'no-store', signal: AbortSignal.timeout(20000),
      });
    } catch { throw new HttpError(502, 'GitHub is unreachable. Try again; your changes are preserved on this device.'); }
  }

  private fail(status: number): never {
    if (status === 401 || status === 403) throw new HttpError(503, 'GitHub access denied or rate limit reached. Check the token and repository permissions.');
    if (status === 404) throw new HttpError(503, 'GitHub repository is inaccessible. Check its configuration and initialize it with a README.');
    throw new HttpError(502, 'GitHub could not save the data. Try again later.');
  }

  async read(): Promise<Remote> {
    // A missing file must not conceal an inaccessible or accidentally public repository.
    const repo = await this.request('');
    if (!repo.ok) this.fail(repo.status);
    const metadata = await repo.json();
    if (metadata.private !== true) throw new HttpError(503, 'The data repository must be private before synchronizing.');
    const response = await this.request(`/contents/library.json?ref=${encodeURIComponent(this.config.branch)}`);
    if (response.status === 404) return { snapshot: emptySnapshot(), revision: null };
    if (!response.ok) this.fail(response.status);
    const file = await response.json();
    if (file.type !== 'file' || !/^[a-f0-9]{40,64}$/.test(file.sha) || file.size > MAX_BYTES) throw new HttpError(413, 'The GitHub file is invalid or too large.');
    let content = file.content;
    if (file.encoding !== 'base64' || !content) {
      const blob = await this.request(`/git/blobs/${file.sha}`);
      if (!blob.ok) this.fail(blob.status);
      const payload = await blob.json();
      if (payload.encoding !== 'base64' || payload.size > MAX_BYTES) throw new HttpError(413, 'The GitHub file is too large.');
      content = payload.content;
    }
    try {
      const snapshot = validateSnapshot(JSON.parse(Buffer.from(content, 'base64').toString('utf8')));
      return { snapshot, revision: file.sha };
    } catch { throw new HttpError(422, 'The library.json file on GitHub is invalid. No data was overwritten.'); }
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
      const result = await response.json();
      return { conflict: false as const, snapshot, revision: result.content.sha as string, lastSyncedAt: new Date().toISOString() };
    }
    throw new HttpError(409, 'Another device is synchronizing at the same time. Try again in a few seconds.');
  }
}
