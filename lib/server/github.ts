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
    } catch { throw new HttpError(502, 'GitHub est injoignable. Réessayez ; vos modifications sont conservées sur cet appareil.'); }
  }

  private fail(status: number): never {
    if (status === 401 || status === 403) throw new HttpError(503, 'Accès GitHub refusé ou quota atteint. Vérifiez le token et les droits du dépôt.');
    if (status === 404) throw new HttpError(503, 'Dépôt GitHub inaccessible. Vérifiez sa configuration et initialisez-le avec un README.');
    throw new HttpError(502, 'GitHub n’a pas pu enregistrer les données. Réessayez ultérieurement.');
  }

  async read(): Promise<Remote> {
    // A missing file must not conceal an inaccessible or accidentally public repository.
    const repo = await this.request('');
    if (!repo.ok) this.fail(repo.status);
    const metadata = await repo.json();
    if (metadata.private !== true) throw new HttpError(503, 'Le dépôt de données doit être privé avant toute synchronisation.');
    const response = await this.request(`/contents/library.json?ref=${encodeURIComponent(this.config.branch)}`);
    if (response.status === 404) return { snapshot: emptySnapshot(), revision: null };
    if (!response.ok) this.fail(response.status);
    const file = await response.json();
    if (file.type !== 'file' || !/^[a-f0-9]{40,64}$/.test(file.sha) || file.size > MAX_BYTES) throw new HttpError(413, 'Le fichier GitHub est invalide ou trop volumineux.');
    let content = file.content;
    if (file.encoding !== 'base64' || !content) {
      const blob = await this.request(`/git/blobs/${file.sha}`);
      if (!blob.ok) this.fail(blob.status);
      const payload = await blob.json();
      if (payload.encoding !== 'base64' || payload.size > MAX_BYTES) throw new HttpError(413, 'Le fichier GitHub est trop volumineux.');
      content = payload.content;
    }
    try {
      const snapshot = validateSnapshot(JSON.parse(Buffer.from(content, 'base64').toString('utf8')));
      return { snapshot, revision: file.sha };
    } catch { throw new HttpError(422, 'Le fichier library.json de GitHub est invalide. Aucune donnée n’a été écrasée.'); }
  }

  async synchronize(base: Snapshot, local: Snapshot) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await this.read();
      let merged: ReturnType<typeof mergeSnapshots>;
      try { merged = mergeSnapshots(base, local, remote.snapshot); }
      catch { throw new HttpError(409, 'Les modifications combinées sont incompatibles. Vérifiez les decks et les cartes avant de réessayer. Vos données sont conservées.'); }
      if (merged.conflicts.length) return { conflict: true as const, snapshot: merged.snapshot, remote: remote.snapshot, conflicts: merged.conflicts };
      let snapshot: Snapshot;
      try { snapshot = validateSnapshot(merged.snapshot); }
      catch { throw new HttpError(409, 'Les modifications combinées sont incompatibles. Synchronisez puis vérifiez les decks et les cartes.'); }
      if (snapshotsEqual(snapshot, remote.snapshot)) return { conflict: false as const, snapshot, revision: remote.revision, lastSyncedAt: new Date().toISOString() };
      const encoded = JSON.stringify(snapshot, null, 2);
      if (Buffer.byteLength(encoded) > MAX_BYTES) throw new HttpError(413, 'Bibliothèque trop volumineuse pour cette V1 (4 Mo). Exportez vos données.');
      const response = await this.request('/contents/library.json', {
        method: 'PUT',
        body: JSON.stringify({ message: '[Codex] Synchronise library', content: Buffer.from(encoded).toString('base64'), branch: this.config.branch, ...(remote.revision ? { sha: remote.revision } : {}) }),
      });
      if (response.status === 409 || response.status === 422) continue;
      if (!response.ok) this.fail(response.status);
      const result = await response.json();
      return { conflict: false as const, snapshot, revision: result.content.sha as string, lastSyncedAt: new Date().toISOString() };
    }
    throw new HttpError(409, 'Un autre appareil synchronise en même temps. Réessayez dans quelques secondes.');
  }
}
