import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfig, getRepositoryMetadata } from '../lib/server/config';
import { GET as status } from '../app/api/status/route';

const secrets = {
  GITHUB_CLIENT_ID: 'testclient', GITHUB_CLIENT_SECRET: 'server-oauth-secret',
  GITHUB_DATA_TOKEN: 'private-server-token', SESSION_SECRET: 'a-session-secret-of-at-least-32-characters',
};
const keys = [...Object.keys(secrets), 'GITHUB_ALLOWED_USER', 'GITHUB_DATA_OWNER', 'GITHUB_DATA_REPO', 'GITHUB_DATA_BRANCH', 'APP_URL'];

async function withEnv(values: Record<string, string | undefined>, run: () => void | Promise<void>) {
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(values)) if (value !== undefined) process.env[key] = value;
  try { await run(); }
  finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

test('four server secrets configure the preset personal repository', async () => {
  await withEnv(secrets, () => {
    const config = getConfig();
    assert.ok(config);
    assert.equal(config.owner, 'ThomasFugier');
    assert.equal(config.allowedUser, 'ThomasFugier');
    assert.equal(config.repo, 'NihongoData');
    assert.equal(config.branch, 'main');
    assert.equal(config.appUrl, 'https://japanese-srs-two.vercel.app');
    assert.deepEqual(getRepositoryMetadata(), { repository: 'ThomasFugier/NihongoData', branch: 'main' });
  });
});

test('explicit settings support custom branches and both loopback development URLs', async () => {
  for (const appUrl of ['http://localhost:3000/', 'http://127.0.0.1:4000/']) {
    await withEnv({ ...secrets, GITHUB_ALLOWED_USER: 'Other-User', GITHUB_DATA_OWNER: 'Other-Owner', GITHUB_DATA_REPO: 'Other.Repository', GITHUB_DATA_BRANCH: 'feature/sync', APP_URL: appUrl }, () => {
      const config = getConfig();
      assert.ok(config);
      assert.equal(config.allowedUser, 'Other-User');
      assert.equal(config.appUrl, appUrl.slice(0, -1));
      assert.deepEqual(getRepositoryMetadata(), { repository: 'Other-Owner/Other.Repository', branch: 'feature/sync' });
    });
  }
});

test('missing secrets and invalid settings never produce a usable server config', async () => {
  const invalid: Array<[string, string | undefined]> = [
    ...Object.keys(secrets).map(key => [key, undefined] as [string, undefined]),
    ['GITHUB_CLIENT_ID', 'wrong/client'], ['GITHUB_CLIENT_SECRET', 'with\nnewline'],
    ['GITHUB_DATA_TOKEN', 'with spaces'], ['SESSION_SECRET', 'short'],
    ['GITHUB_ALLOWED_USER', 'not_a_user'], ['GITHUB_DATA_OWNER', 'a'.repeat(40)],
    ['GITHUB_DATA_OWNER', '-owner'], ['GITHUB_DATA_OWNER', 'owner--name'],
    ['GITHUB_DATA_REPO', '..'], ['GITHUB_DATA_REPO', 'owner/repo'],
    ...['', '@', '/main', 'main/', 'a//b', 'a..b', 'a/.hidden', 'a/b.lock', 'main?', 'a\\b', 'a@{b', 'main.'].map(value => ['GITHUB_DATA_BRANCH', value] as [string, string]),
    ...['http://example.com', 'http://127.0.0.2', 'http://localhost.evil', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com/?token=value', 'https://example.com/#value', 'ftp://example.com', 'https:example.com'].map(value => ['APP_URL', value] as [string, string]),
  ];
  for (const [key, value] of invalid) await withEnv({ ...secrets, [key]: value }, () => assert.equal(getConfig(), null, `${key}: ${value}`));
});

test('unconfigured metadata remains safe and falls back from invalid repository labels', async () => {
  await withEnv({ ...secrets, GITHUB_CLIENT_SECRET: undefined, GITHUB_DATA_OWNER: 'bad/token', GITHUB_DATA_REPO: '..', GITHUB_DATA_BRANCH: 'bad\nbranch' }, () => {
    assert.equal(getConfig(), null);
    const metadata = getRepositoryMetadata();
    assert.deepEqual(metadata, { repository: 'ThomasFugier/NihongoData', branch: 'main' });
    for (const secret of Object.values(secrets)) assert.ok(!JSON.stringify(metadata).includes(secret));
  });
});

test('unconfigured status exposes repository labels without server credentials', async () => {
  await withEnv({ ...secrets, GITHUB_CLIENT_SECRET: undefined }, async () => {
    const response = await status();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const payload = await response.json();
    assert.deepEqual(payload, {
      repository: 'ThomasFugier/NihongoData', branch: 'main', configured: false, authenticated: false,
      reason: 'Local mode: GitHub synchronization is not configured.',
    });
    for (const secret of Object.values(secrets)) assert.ok(!JSON.stringify(payload).includes(secret));
  });
});
