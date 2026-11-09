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
    try { url = new URL(path); } catch { throw new Error('Indiquez un dépôt GitHub au format propriétaire/dépôt.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('Utilisez une adresse https://github.com/propriétaire/dépôt.');
    path = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  }
  const parts = path.replace(/\.git$/, '').split('/');
  if (parts.length !== 2 || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(parts[0]) || !/^[a-z\d_.-]{1,100}$/i.test(parts[1]) || ['.', '..'].includes(parts[1])) throw new Error('Indiquez un dépôt GitHub au format propriétaire/dépôt.');
  return { owner: parts[0], repo: parts[1] };
}

function checkedConfig(config: GitHubConfig): GitHubConfig {
  const repo = parseRepository(`${config.owner}/${config.repo}`);
  const branch = config.branch.trim() || 'main';
  const token = config.token.trim();
  if (!token || token.length > 1024 || /\s/.test(token)) throw new Error('Renseignez une clé GitHub valide.');
  if (branch.length > 255 || /[\x00-\x20\x7f]/.test(branch) || branch.startsWith('/') || branch.endsWith('/') || branch.includes('..')) throw new Error('Le nom de branche est invalide.');
  return { ...repo, branch, token };
}

function encodeContent(text: string): string {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > MAX_BYTES) throw new Error('La bibliothèque dépasse la limite de synchronisation de 4 Mo. Exportez une sauvegarde.');
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}

function decodeSnapshot(content: unknown): Snapshot {
  if (typeof content !== 'string' || content.length > MAX_BASE64) throw new Error('Le fichier library.json est trop volumineux.');
  try {
    const binary = atob(content.replace(/\s/g, ''));
    if (binary.length > MAX_BYTES) throw new Error('size');
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return validateSnapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { throw new Error('Le fichier library.json de GitHub est invalide. Aucune donnée n’a été remplacée.'); }
}

function fail(status: number): never {
  if (status === 401) throw new Error('Clé GitHub refusée ou expirée.');
  if (status === 403 || status === 429) throw new Error('Accès GitHub refusé ou quota atteint. Vérifiez les droits Contents en lecture/écriture.');
  if (status === 404) throw new Error('Dépôt introuvable ou inaccessible avec cette clé.');
  throw new Error('GitHub est temporairement indisponible. Vos données locales sont conservées.');
}

/** Personal direct mode: credentials are runtime input, sent only to GitHub.
 * Callers keep the token in memory, never in exports, localStorage or IndexedDB.
 */
export class GitHubClient {
  private config: GitHubConfig;
  constructor(config: GitHubConfig, private fetcher: Fetcher = fetch) { this.config = checkedConfig(config); }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}${path}`;
    try {
      return await this.fetcher(url, {
        ...init,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.config.token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
        cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(20000),
      });
    } catch { throw new Error('GitHub est injoignable. Vérifiez la connexion ; vos données locales sont conservées.'); }
  }

  async read(): Promise<GitHubRemote> {
    const repoResponse = await this.request('');
    if (!repoResponse.ok) fail(repoResponse.status);
    const metadata = await repoResponse.json();
    if (metadata.private !== true) throw new Error('Le dépôt de données doit être privé.');

    // A wrong or uninitialized branch must never look like a new empty library.
    const branch = await this.request(`/git/ref/heads/${encodeURIComponent(this.config.branch)}`);
    if (branch.status === 404 || branch.status === 409) throw new Error('Branche introuvable. Initialisez le dépôt avec un README et vérifiez le nom de branche.');
    if (!branch.ok) fail(branch.status);

    const response = await this.request(`/contents/library.json?ref=${encodeURIComponent(this.config.branch)}`);
    if (response.status === 404) return { snapshot: emptySnapshot(), revision: null };
    if (!response.ok) fail(response.status);
    const file = await response.json();
    if (file.type !== 'file' || typeof file.sha !== 'string' || !/^[a-f0-9]{40,64}$/.test(file.sha) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_BYTES) throw new Error('Le fichier library.json est invalide ou dépasse 4 Mo.');
    let content: unknown = file.content;
    if (file.encoding !== 'base64' || !content) {
      const blob = await this.request(`/git/blobs/${file.sha}`);
      if (!blob.ok) fail(blob.status);
      const payload = await blob.json();
      if (payload.encoding !== 'base64' || !Number.isSafeInteger(payload.size) || payload.size < 0 || payload.size > MAX_BYTES) throw new Error('Le fichier library.json est trop volumineux.');
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
      catch { throw new Error('Les modifications sont incompatibles. Vérifiez les decks et les cartes avant de synchroniser.'); }
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
      if (typeof result.content?.sha !== 'string') throw new Error('Réponse GitHub inattendue. Relancez la synchronisation pour vérifier la sauvegarde.');
      return { conflict: false, snapshot, revision: result.content.sha, lastSyncedAt: new Date().toISOString() };
    }
    throw new Error('Un autre appareil synchronise en même temps. Réessayez dans quelques secondes.');
  }
}

export const readGitHub = (config: GitHubConfig, fetcher?: Fetcher) => new GitHubClient(config, fetcher).read();
export const syncGitHub = (config: GitHubConfig, base: Snapshot, local: Snapshot, fetcher?: Fetcher) => new GitHubClient(config, fetcher).synchronize(base, local);
