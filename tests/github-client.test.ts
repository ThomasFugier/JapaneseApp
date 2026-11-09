import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubClient, parseRepository, type GitHubConfig } from '../lib/github-client';
import { seedSnapshot } from '../lib/seed';
import { effectiveReviews } from '../lib/engine';
import { emptySnapshot, type Snapshot } from '../lib/model';

const config: GitHubConfig = { owner: 'owner', repo: 'private-data', branch: 'main', token: 'test-runtime-token' };
const fileResponse = (snapshot: Snapshot, sha = 'a'.repeat(40)) => Response.json({ type: 'file', size: Buffer.byteLength(JSON.stringify(snapshot)), sha, encoding: 'base64', content: Buffer.from(JSON.stringify(snapshot)).toString('base64') });
const branchResponse = () => Response.json({ ref: 'refs/heads/main', object: { sha: 'a'.repeat(40) } });

test('repository input accepts owner/name and canonical HTTPS URLs only', () => {
  assert.deepEqual(parseRepository(' owner/private-data '), { owner: 'owner', repo: 'private-data' });
  assert.deepEqual(parseRepository('https://github.com/owner/private-data.git/'), { owner: 'owner', repo: 'private-data' });
  for (const value of ['https://evil.example/owner/repo', 'https://user:secret@github.com/owner/repo', 'https://github.com/owner/repo?token=x', 'owner/..', 'owner/repo/tree/main', 'http://github.com/owner/repo']) assert.throws(() => parseRepository(value));
});

test('public repositories are refused before any content request', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json({ private: false }); };
  await assert.rejects(new GitHubClient(config, fetcher).read(), /doit être privé/);
  assert.equal(calls, 1);
});

test('missing branch is not mistaken for an empty library', async () => {
  let contentsRequests = 0;
  const fetcher: typeof fetch = async input => {
    const url = String(input);
    if (url.includes('/git/ref/')) return Response.json({}, { status: 404 });
    if (url.includes('/contents/')) contentsRequests++;
    return Response.json({ private: true });
  };
  await assert.rejects(new GitHubClient(config, fetcher).read(), /Branche introuvable/);
  assert.equal(contentsRequests, 0);
});

test('an existing private branch with no library can initialize safely', async () => {
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
  const result = await new GitHubClient(config, fetcher).read();
  assert.equal(result.revision, null);
  assert.deepEqual(result.snapshot, emptySnapshot());
});

test('concurrent writes retry without losing review undo events and become idempotent', async () => {
  const base = seedSnapshot();
  base.reviews.push({ id: 'review-original', cardId: base.cards[0].id, rating: 4, reviewedAt: '2026-11-01T10:00:00.000Z' });
  const local = structuredClone(base);
  local.reviewUndos.push({ id: 'undo-original', reviewId: 'review-original', undoneAt: '2026-11-01T10:01:00.000Z' });
  local.notes[0].meaning = 'Manger quelque chose';
  let remote = structuredClone(base);
  remote.notes[1].explanation = 'Une précision depuis un autre appareil.';
  remote.reviews.push({ id: 'review-remote', cardId: base.cards[1].id, rating: 3, reviewedAt: '2026-11-01T10:02:00.000Z' });
  let writes = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (init?.method === 'PUT') {
      writes++;
      if (writes === 1) return Response.json({}, { status: 409 });
      const body = JSON.parse(String(init.body));
      assert.equal(body.sha, 'b'.repeat(40));
      remote = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      return Response.json({ content: { sha: 'c'.repeat(40) } });
    }
    if (url.includes('/git/ref/')) return branchResponse();
    if (url.includes('/contents/')) return fileResponse(writes ? remote : base, writes ? 'b'.repeat(40) : 'a'.repeat(40));
    return Response.json({ private: true });
  };
  const client = new GitHubClient(config, fetcher);
  const result = await client.synchronize(base, local);
  assert.equal(result.conflict, false);
  assert.equal(writes, 2);
  assert.equal(remote.reviewUndos.length, 1);
  assert.equal(remote.reviews.length, 2);
  assert.equal(effectiveReviews(remote, base.cards[0].id).length, 0);
  assert.equal(remote.notes.find(note => note.id === local.notes[0].id)?.meaning, local.notes[0].meaning);
  assert.equal(remote.notes.find(note => note.id === base.notes[1].id)?.explanation, 'Une précision depuis un autre appareil.');
  const repeated = await client.synchronize(base, local);
  assert.equal(repeated.conflict, false);
  assert.equal(writes, 2);
});

test('large Contents responses use the bounded Git blob endpoint and preserve Japanese', async () => {
  const data = seedSnapshot();
  let blobs = 0;
  const fetcher: typeof fetch = async input => {
    const url = String(input);
    if (url.includes('/git/ref/')) return branchResponse();
    if (url.includes('/contents/')) return Response.json({ type: 'file', size: 2000, sha: 'a'.repeat(40), encoding: 'none', content: '' });
    if (url.includes('/git/blobs/')) { blobs++; return Response.json({ encoding: 'base64', size: Buffer.byteLength(JSON.stringify(data)), content: Buffer.from(JSON.stringify(data)).toString('base64') }); }
    return Response.json({ private: true });
  };
  const result = await new GitHubClient(config, fetcher).read();
  assert.equal(blobs, 1);
  assert.equal(result.snapshot.notes[0].japanese, data.notes[0].japanese);
});

test('network error messages never reflect runtime credentials', async () => {
  const fetcher: typeof fetch = async () => { throw new Error(`request failed ${config.token}`); };
  await assert.rejects(new GitHubClient(config, fetcher).read(), error => error instanceof Error && !error.message.includes(config.token) && /injoignable/.test(error.message));
});
