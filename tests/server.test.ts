import test from 'node:test';
import assert from 'node:assert/strict';
import { signPayload, verifyPayload } from '../lib/server/session';
import { assertOrigin, boundedJson, HttpError } from '../lib/server/http';
import { GitHubStore } from '../lib/server/github';
import { emptySnapshot } from '../lib/model';
import type { ServerConfig } from '../lib/server/config';

const secret = 'this-is-a-test-secret-with-at-least-32-characters';
const config: ServerConfig = {
  clientId: 'test', clientSecret: 'test', allowedUser: 'owner', owner: 'owner',
  repo: 'private-data', branch: 'main', token: 'never-send-to-browser', secret, appUrl: 'https://kotoba.example',
};

test('session rejects tampering, expiry and a different signing secret', () => {
  const signed = signPayload({ login: 'owner', exp: 2000 }, secret);
  assert.equal(verifyPayload<{ login: string; exp: number }>(signed, secret, 1000)?.login, 'owner');
  assert.equal(verifyPayload(signed, secret, 2000), null);
  assert.equal(verifyPayload(signed, `${secret}different`, 1000), null);
  const forged = `${Buffer.from(JSON.stringify({ login: 'attacker', exp: 3000 })).toString('base64url')}.${signed.split('.')[1]}`;
  assert.equal(verifyPayload(forged, secret, 1000), null);
  assert.equal(verifyPayload('malformed', secret, 1000), null);
});

test('mutations reject foreign or missing Origin and enforce streamed size limit', async () => {
  assert.doesNotThrow(() => assertOrigin(new Request(config.appUrl, { headers: { origin: config.appUrl } }), config.appUrl));
  assert.throws(() => assertOrigin(new Request(config.appUrl, { headers: { origin: 'https://attacker.example' } }), config.appUrl), HttpError);
  assert.throws(() => assertOrigin(new Request(config.appUrl), config.appUrl), HttpError);
  await assert.rejects(boundedJson(new Request(config.appUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(100) }) }), 32), (error: unknown) => error instanceof HttpError && error.status === 413);
});

test('GitHub sync rereads concurrent updates and preserves both additions', async () => {
  const base = emptySnapshot();
  const local = emptySnapshot();
  const remote = emptySnapshot();
  const makeDeck = (id: string) => ({ id, name: id, parentId: null, color: 'sage' as const, description: '', updatedAt: '2026-01-01T00:00:00.000Z' });
  local.decks.push(makeDeck('local'));
  remote.decks.push(makeDeck('remote'));
  let attempts = 0;
  let written: typeof remote | null = null;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (init?.method === 'PUT') {
      attempts++;
      if (attempts === 1) return Response.json({}, { status: 409 });
      const body = JSON.parse(String(init.body));
      assert.equal(body.sha, 'b'.repeat(40));
      written = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      return Response.json({ content: { sha: 'c'.repeat(40) } });
    }
    if (url.includes('/contents/')) {
      const snapshot = attempts ? remote : base;
      return Response.json({ type: 'file', size: 100, sha: (attempts ? 'b' : 'a').repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(snapshot)).toString('base64') });
    }
    return Response.json({ private: true });
  };
  const result = await new GitHubStore(config, fetcher).synchronize(base, local);
  assert.equal(result.conflict, false);
  assert.equal(attempts, 2);
  assert.deepEqual(written!.decks.map(deck => deck.id).sort(), ['local', 'remote']);
});

test('GitHub sync never publishes private library data to a public repository', async () => {
  let writes = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    if (init?.method === 'PUT') writes++;
    return Response.json({ private: false });
  };
  await assert.rejects(new GitHubStore(config, fetcher).synchronize(emptySnapshot(), emptySnapshot()), (error: unknown) => error instanceof HttpError && error.status === 503);
  assert.equal(writes, 0);
});

test('GitHub sync returns incompatible edits for a user choice without writing', async () => {
  const base = emptySnapshot();
  base.decks.push({ id: 'shared', name: 'Original', parentId: null, color: 'sage', description: '', updatedAt: '2026-01-01T00:00:00.000Z' });
  const local = structuredClone(base); local.decks[0].name = 'Local edit';
  const remote = structuredClone(base); remote.decks[0].name = 'Phone edit';
  let writes = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (init?.method === 'PUT') writes++;
    if (String(input).includes('/contents/')) return Response.json({ type: 'file', size: 100, sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(remote)).toString('base64') });
    return Response.json({ private: true });
  };
  const result = await new GitHubStore(config, fetcher).synchronize(base, local);
  assert.equal(result.conflict, true);
  if (result.conflict) {
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].id, 'shared');
    assert.equal(result.remote.decks[0].name, 'Phone edit');
  }
  assert.equal(writes, 0);
});

test('individually valid moves that combine into a deck cycle never reach GitHub', async () => {
  const base = emptySnapshot();
  const makeDeck = (id: string) => ({ id, name: id, parentId: null as string | null, color: 'sage' as const, description: '', updatedAt: '2026-01-01T00:00:00.000Z' });
  base.decks.push(makeDeck('a'), makeDeck('b'));
  const local = structuredClone(base); local.decks[0].parentId = 'b';
  const remote = structuredClone(base); remote.decks[1].parentId = 'a';
  let writes = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (init?.method === 'PUT') writes++;
    if (String(input).includes('/contents/')) return Response.json({ type: 'file', size: 100, sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(remote)).toString('base64') });
    return Response.json({ private: true });
  };
  await assert.rejects(new GitHubStore(config, fetcher).synchronize(base, local), (error: unknown) => error instanceof HttpError && error.status === 409);
  assert.equal(writes, 0);
});

test('retry after a lost success response creates no second commit', async () => {
  const base = emptySnapshot();
  const local = emptySnapshot();
  local.decks.push({ id: 'already-saved', name: 'Saved', parentId: null, color: 'sage', description: '', updatedAt: '2026-01-01T00:00:00.000Z' });
  let writes = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (init?.method === 'PUT') writes++;
    if (String(input).includes('/contents/')) return Response.json({ type: 'file', size: 100, sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(local)).toString('base64') });
    return Response.json({ private: true });
  };
  const result = await new GitHubStore(config, fetcher).synchronize(base, local);
  assert.equal(result.conflict, false);
  assert.equal(result.snapshot.decks.length, 1);
  assert.equal(writes, 0);
});
