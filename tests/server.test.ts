import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_MAX_AGE, cookieOptions, signPayload, verifyPayload } from '../lib/server/session';
import { assertOrigin, boundedJson, HttpError } from '../lib/server/http';
import { GitHubStore } from '../lib/server/github';
import { emptySnapshot } from '../lib/model';
import type { ServerConfig } from '../lib/server/config';
import { parseSyncInput } from '../lib/server/sync-input';
import { seedSnapshot } from '../lib/seed';
import { createReview } from '../lib/engine';

const secret = 'this-is-a-test-secret-with-at-least-32-characters';
const config: ServerConfig = {
  clientId: 'test', clientSecret: 'test', allowedUser: 'owner', owner: 'owner',
  repo: 'private-data', branch: 'main', token: 'never-send-to-browser', secret, appUrl: 'https://kotoba.example',
};
const branchResponse = () => Response.json({ ref: `refs/heads/${config.branch}`, object: { sha: 'a'.repeat(40) } });

test('old app tabs must reload before sync; current clients can migrate an old baseline', () => {
  const current = emptySnapshot();
  for (const schemaVersion of [1, 2, 3]) {
    const legacy = { ...current, schemaVersion };
    const body = { base: legacy, snapshot: legacy }, before = structuredClone(body);
    assert.throws(() => parseSyncInput(body), (error: unknown) => error instanceof HttpError && error.status === 426 && /Reload/.test(error.message));
    assert.deepEqual(body, before);
    assert.deepEqual(parseSyncInput({ base: legacy, snapshot: current }), { base: current, snapshot: current });
  }
  for (const body of [null, {}, { base: current, snapshot: { ...current, schemaVersion: 99 } }]) {
    assert.throws(() => parseSyncInput(body), (error: unknown) => error instanceof HttpError && error.status === 400);
  }
});

test('GitHub sync preserves custom deadlines while merging a newer spacing preference', async () => {
  const base = seedSnapshot(), local = structuredClone(base), remote = structuredClone(base);
  local.reviewSettings = { ...local.reviewSettings, mode: 'custom', updatedAt: '2026-11-13T10:00:00.000Z' };
  local.reviews.push(createReview(local, 'card-taberu', 4, new Date('2026-11-13T10:01:00.000Z'), 'desktop-easy'));
  remote.reviewSettings = { ...remote.reviewSettings, mode: 'custom', easyMinutes: 90 * 1440, updatedAt: '2026-11-13T10:02:00.000Z' };
  let written: unknown;
  const fetcher: typeof fetch = async (input, init) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body));
      written = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      return Response.json({ content: { sha: 'b'.repeat(40) } });
    }
    if (String(input).includes('/git/ref/')) return branchResponse();
    if (String(input).includes('/contents/')) return Response.json({ type: 'file', size: 100, sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(remote)).toString('base64') });
    return Response.json({ private: true });
  };
  const result = await new GitHubStore(config, fetcher).synchronize(base, local);
  assert.equal(result.conflict, false);
  if (!result.conflict) {
    assert.deepEqual(result.snapshot.reviewSettings, remote.reviewSettings);
    assert.deepEqual(result.snapshot.reviews, local.reviews);
    assert.deepEqual(written, result.snapshot);
  }
});

test('session rejects tampering, expiry and a different signing secret', () => {
  const signed = signPayload({ login: 'owner', exp: 2000 }, secret);
  assert.equal(verifyPayload<{ login: string; exp: number }>(signed, secret, 1000)?.login, 'owner');
  assert.equal(verifyPayload(signed, secret, 2000), null);
  assert.equal(verifyPayload(signed, `${secret}different`, 1000), null);
  const forged = `${Buffer.from(JSON.stringify({ login: 'attacker', exp: 3000 })).toString('base64url')}.${signed.split('.')[1]}`;
  assert.equal(verifyPayload(forged, secret, 1000), null);
  assert.equal(verifyPayload('malformed', secret, 1000), null);
});

test('personal sessions last 90 days with HttpOnly and production Secure cookies', () => {
  assert.equal(SESSION_MAX_AGE, 90 * 24 * 60 * 60);
  const now = Date.now();
  const signed = signPayload({ login: 'owner', exp: now + SESSION_MAX_AGE * 1000 }, secret);
  assert.equal(verifyPayload<{ login: string; exp: number }>(signed, secret, now + 89 * 24 * 60 * 60 * 1000)?.login, 'owner');
  assert.equal(verifyPayload(signed, secret, now + SESSION_MAX_AGE * 1000), null);
  assert.deepEqual(cookieOptions(config, SESSION_MAX_AGE), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE });
  assert.equal(cookieOptions({ ...config, appUrl: 'http://localhost:3000' }, SESSION_MAX_AGE).secure, false);
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
    if (url.includes('/git/ref/')) return branchResponse();
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
    if (String(input).includes('/git/ref/')) return branchResponse();
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
    if (String(input).includes('/git/ref/')) return branchResponse();
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
    if (String(input).includes('/git/ref/')) return branchResponse();
    if (String(input).includes('/contents/')) return Response.json({ type: 'file', size: 100, sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(local)).toString('base64') });
    return Response.json({ private: true });
  };
  const result = await new GitHubStore(config, fetcher).synchronize(base, local);
  assert.equal(result.conflict, false);
  assert.equal(result.snapshot.decks.length, 1);
  assert.equal(writes, 0);
});

test('missing or uninitialized branches never become empty libraries or writes', async () => {
  for (const status of [404, 409]) {
    let contents = 0;
    let writes = 0;
    const fetcher: typeof fetch = async (input, init) => {
      if (init?.method === 'PUT') writes++;
      if (String(input).includes('/git/ref/')) return Response.json({}, { status });
      if (String(input).includes('/contents/')) contents++;
      return Response.json({ private: true });
    };
    await assert.rejects(new GitHubStore(config, fetcher).synchronize(emptySnapshot(), emptySnapshot()), error => error instanceof HttpError && error.status === 503 && /branch not found/i.test(error.message));
    assert.equal(contents, 0);
    assert.equal(writes, 0);
  }
});

test('private branches without library.json can initialize and never follow token redirects', async () => {
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith('https://api.github.com/repos/owner/private-data'));
    assert.ok(!url.includes(config.token));
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.redirect, 'error');
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${config.token}`);
    if (url.includes('/git/ref/')) return branchResponse();
    if (url.includes('/contents/')) return Response.json({}, { status: 404 });
    return Response.json({ private: true });
  };
  const remote = await new GitHubStore(config, fetcher).read();
  assert.equal(remote.revision, null);
  assert.deepEqual(remote.snapshot, emptySnapshot());
});

test('malformed branch responses are refused before reading library content', async () => {
  for (const payload of [null, [], { private: true }, { ref: 'refs/heads/wrong', object: { sha: 'a'.repeat(40) } }]) {
    let contents = 0;
    const fetcher: typeof fetch = async input => {
      if (String(input).includes('/git/ref/')) return Response.json(payload);
      if (String(input).includes('/contents/')) contents++;
      return Response.json({ private: true });
    };
    await assert.rejects(new GitHubStore(config, fetcher).read(), error => error instanceof HttpError && error.status === 502);
    assert.equal(contents, 0);
  }
});

test('Git blob fallback preserves Japanese and accepts GitHub base64 line breaks', async () => {
  const snapshot = emptySnapshot();
  snapshot.decks.push({ id: 'jp', name: '日本語', parentId: null, color: 'sage', description: '', updatedAt: '2026-01-01T00:00:00.000Z' });
  const text = JSON.stringify(snapshot);
  let blobs = 0;
  const fetcher: typeof fetch = async input => {
    const url = String(input);
    if (url.includes('/git/ref/')) return branchResponse();
    if (url.includes('/contents/')) return Response.json({ type: 'file', size: Buffer.byteLength(text), sha: 'a'.repeat(40), encoding: 'none', content: '' });
    if (url.includes('/git/blobs/')) {
      blobs++;
      return Response.json({ encoding: 'base64', size: Buffer.byteLength(text), content: Buffer.from(text).toString('base64').replace(/.{60}/g, '$&\n') });
    }
    return Response.json({ private: true });
  };
  const remote = await new GitHubStore(config, fetcher).read();
  assert.equal(blobs, 1);
  assert.equal(remote.snapshot.decks[0].name, '日本語');
});

test('contents and blobs enforce shape and declared byte limits', async () => {
  const file = { type: 'file', size: 100, sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(emptySnapshot())).toString('base64') };
  const malformedFiles = [null, [], { ...file, type: 'dir' }, { ...file, sha: 'a'.repeat(41) }, { ...file, size: -1 }, { ...file, size: '100' }, { ...file, size: 4 * 1024 * 1024 + 1 }];
  for (const payload of malformedFiles) {
    const fetcher: typeof fetch = async input => {
      if (String(input).includes('/git/ref/')) return branchResponse();
      if (String(input).includes('/contents/')) return Response.json(payload);
      return Response.json({ private: true });
    };
    await assert.rejects(new GitHubStore(config, fetcher).read(), error => error instanceof HttpError && error.status === 413);
  }
  for (const payload of [null, { encoding: 'base64', size: -1, content: 'e30=' }, { encoding: 'base64', size: 4 * 1024 * 1024 + 1, content: 'e30=' }, { encoding: 'utf8', size: 2, content: '{}' }]) {
    const fetcher: typeof fetch = async input => {
      if (String(input).includes('/git/ref/')) return branchResponse();
      if (String(input).includes('/contents/')) return Response.json({ ...file, encoding: 'none', content: '' });
      if (String(input).includes('/git/blobs/')) return Response.json(payload);
      return Response.json({ private: true });
    };
    await assert.rejects(new GitHubStore(config, fetcher).read(), error => error instanceof HttpError && error.status === 413);
  }
});

test('invalid base64 and UTF-8 are rejected rather than silently repaired', async () => {
  const snapshot = emptySnapshot();
  snapshot.decks.push({ id: 'invalid', name: 'invalid-utf8', parentId: null, color: 'sage', description: '', updatedAt: '2026-01-01T00:00:00.000Z' });
  const bytes = Buffer.from(JSON.stringify(snapshot));
  bytes[bytes.indexOf('invalid-utf8')] = 0xff;
  for (const content of [42, {}, '!bad-base64!', bytes.toString('base64')]) {
    const fetcher: typeof fetch = async input => {
      if (String(input).includes('/git/ref/')) return branchResponse();
      if (String(input).includes('/contents/')) return Response.json({ type: 'file', size: bytes.length, sha: 'a'.repeat(40), encoding: 'base64', content });
      return Response.json({ private: true });
    };
    await assert.rejects(new GitHubStore(config, fetcher).read(), error => error instanceof HttpError && error.status === 422);
  }
});

test('decoded bytes cannot exceed the limit even when GitHub declares a smaller file', async () => {
  const content = Buffer.alloc(4 * 1024 * 1024 + 1, 0x20).toString('base64');
  const fetcher: typeof fetch = async input => {
    if (String(input).includes('/git/ref/')) return branchResponse();
    if (String(input).includes('/contents/')) return Response.json({ type: 'file', size: 100, sha: 'a'.repeat(40), encoding: 'base64', content });
    return Response.json({ private: true });
  };
  await assert.rejects(new GitHubStore(config, fetcher).read(), error => error instanceof HttpError && error.status === 413);
});

test('oversized streamed GitHub JSON is canceled without trusting Content-Length', async () => {
  let canceled = false;
  const fetcher: typeof fetch = async input => {
    if (String(input).includes('/git/ref/')) return branchResponse();
    if (String(input).includes('/contents/')) return new Response(new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
      cancel() { canceled = true; },
    }));
    return Response.json({ private: true });
  };
  await assert.rejects(new GitHubStore(config, fetcher).read(), error => error instanceof HttpError && error.status === 413);
  assert.equal(canceled, true);
});

test('network failures never reflect server credentials', async () => {
  const fetcher: typeof fetch = async () => { throw new Error(`failed with ${config.token}`); };
  await assert.rejects(new GitHubStore(config, fetcher).read(), error => error instanceof HttpError && error.status === 502 && !error.message.includes(config.token));
});
