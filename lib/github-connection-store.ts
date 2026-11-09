import { validateGitHubConfig, type GitHubConfig } from './github-client';

type ConnectionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const KEY = 'japanese-github-connection-v1';

function checkedConnection(value: unknown): GitHubConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The GitHub connection is invalid.');
  const config = value as Record<string, unknown>;
  if (['owner', 'repo', 'branch', 'token'].some(key => typeof config[key] !== 'string')) throw new Error('The GitHub connection is invalid.');
  return validateGitHubConfig(config as GitHubConfig);
}

export function loadGitHubConnection(storage?: ConnectionStorage): GitHubConfig | null {
  let target: ConnectionStorage;
  let saved: string | null;
  try {
    target = storage ?? globalThis.localStorage;
    saved = target.getItem(KEY);
  } catch { return null; }
  if (saved === null) return null;
  try { return checkedConnection(JSON.parse(saved)); }
  catch {
    try { target.removeItem(KEY); } catch { /* Corrupt storage is ignored even if cleanup fails. */ }
    return null;
  }
}

export function saveGitHubConnection(config: GitHubConfig, storage?: ConnectionStorage): GitHubConfig {
  const connection = checkedConnection(config);
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(KEY, JSON.stringify(connection));
    return connection;
  } catch { throw new Error('The GitHub connection could not be saved on this device.'); }
}

export function forgetGitHubConnection(storage?: ConnectionStorage): void {
  try {
    const target = storage ?? globalThis.localStorage;
    target.removeItem(KEY);
  } catch { throw new Error('The GitHub connection could not be forgotten on this device.'); }
}
