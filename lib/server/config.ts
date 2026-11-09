import { HttpError } from './http';

export type ServerConfig = {
  clientId: string;
  clientSecret: string;
  allowedUser: string;
  owner: string;
  repo: string;
  branch: string;
  token: string;
  secret: string;
  appUrl: string;
};

const defaults = {
  allowedUser: 'ThomasFugier', owner: 'ThomasFugier', repo: 'NihongoData',
  branch: 'main', appUrl: 'https://japanese-srs-two.vercel.app',
};
const validUser = (value: string) => /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value) && !value.includes('--');
const validRepo = (value: string) => /^[a-z\d_.-]{1,100}$/i.test(value) && !['.', '..'].includes(value);
const validBranch = (value: string) => value.length > 0 && value.length <= 255 && value !== '@'
  && !/[\x00-\x20\x7f~^:?*\[\\]/.test(value) && !value.includes('..') && !value.includes('@{')
  && !value.endsWith('.') && value.split('/').every(part => part && !part.startsWith('.') && !part.endsWith('.lock'));
const setting = (name: string, fallback: string) => (process.env[name] ?? fallback).trim();
const validSecret = (value: string, minimum = 1) => value.length >= minimum && value.length <= 4096 && /^[\x21-\x7e]+$/.test(value);

/** Only repository labels may cross the server/client boundary. */
export function getRepositoryMetadata(): { repository: string; branch: string } {
  const owner = setting('GITHUB_DATA_OWNER', defaults.owner);
  const repo = setting('GITHUB_DATA_REPO', defaults.repo);
  const branch = setting('GITHUB_DATA_BRANCH', defaults.branch);
  return {
    repository: `${validUser(owner) ? owner : defaults.owner}/${validRepo(repo) ? repo : defaults.repo}`,
    branch: validBranch(branch) ? branch : defaults.branch,
  };
}

export function getConfig(): ServerConfig | null {
  const config: ServerConfig = {
    clientId: setting('GITHUB_CLIENT_ID', ''),
    clientSecret: setting('GITHUB_CLIENT_SECRET', ''),
    allowedUser: setting('GITHUB_ALLOWED_USER', defaults.allowedUser),
    owner: setting('GITHUB_DATA_OWNER', defaults.owner),
    repo: setting('GITHUB_DATA_REPO', defaults.repo),
    branch: setting('GITHUB_DATA_BRANCH', defaults.branch),
    token: setting('GITHUB_DATA_TOKEN', ''),
    secret: setting('SESSION_SECRET', ''),
    appUrl: setting('APP_URL', defaults.appUrl),
  };
  if (!/^[a-z\d_]{1,128}$/i.test(config.clientId) || !validSecret(config.clientSecret) || !validSecret(config.token) || !validSecret(config.secret, 32)) return null;
  if (!validUser(config.allowedUser) || !validUser(config.owner) || !validRepo(config.repo) || !validBranch(config.branch)) return null;
  try {
    const url = new URL(config.appUrl);
    if (!/^https?:\/\//i.test(config.appUrl) || !url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
    return { ...config, appUrl: url.origin };
  } catch { return null; }
}

export function requireConfig(): ServerConfig {
  const config = getConfig();
  if (!config) throw new HttpError(503, 'GitHub synchronization is not configured. Your data remains saved on this device.');
  return config;
}
