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

export function getConfig(): ServerConfig | null {
  const values = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    allowedUser: process.env.GITHUB_ALLOWED_USER,
    owner: process.env.GITHUB_DATA_OWNER,
    repo: process.env.GITHUB_DATA_REPO,
    token: process.env.GITHUB_DATA_TOKEN,
    secret: process.env.SESSION_SECRET,
    appUrl: process.env.APP_URL,
  };
  if (Object.values(values).some(value => !value?.trim())) return null;
  const config = values as Omit<ServerConfig, 'branch'>;
  if (config.secret.length < 32) return null;
  if (![config.allowedUser, config.owner, config.repo].every(value => /^[a-z\d_.-]+$/i.test(value))) return null;
  try {
    const url = new URL(config.appUrl);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
    return { ...config, appUrl: url.origin, branch: process.env.GITHUB_DATA_BRANCH || 'main' };
  } catch { return null; }
}

export function requireConfig(): ServerConfig {
  const config = getConfig();
  if (!config) throw new HttpError(503, 'GitHub synchronization is not configured. Your data remains saved on this device.');
  return config;
}
