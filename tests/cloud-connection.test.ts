import test from 'node:test';
import assert from 'node:assert/strict';
import { needsCloudBootstrap, type CloudConnectionStatus } from '../lib/cloud-connection';
import { emptySnapshot } from '../lib/model';
import { seedSnapshot } from '../lib/seed';
import type { LibraryState } from '../lib/storage';

const connected: CloudConnectionStatus = { configured: true, authenticated: true, repository: 'ThomasFugier/NihongoData', branch: 'main' };
const local = (): LibraryState => ({ snapshot: seedSnapshot(), base: emptySnapshot(), lastSyncedAt: null });

test('a signed-in new device loads its private cloud library', () => {
  assert.equal(needsCloudBootstrap(connected, null), true);
  assert.equal(needsCloudBootstrap(null, null), false);
  assert.equal(needsCloudBootstrap({ ...connected, authenticated: false }, null), false);
  assert.equal(needsCloudBootstrap({ ...connected, configured: false }, null), false);
});

test('untouched demonstration content is replaced instead of uploaded', () => {
  assert.equal(needsCloudBootstrap(connected, local()), true);
  const saved = local();
  saved.snapshot.notes.forEach(note => { note.updatedAt = '2026-11-09T12:00:00.000Z'; });
  assert.equal(needsCloudBootstrap(connected, saved), true);
});

test('personal edits, real reviews and prior synchronization prevent replacement', () => {
  const edited = local(); edited.snapshot.notes[0].meaning = 'My edited word';
  assert.equal(needsCloudBootstrap(connected, edited), false);
  const reviewed = local(); reviewed.snapshot.reviews.push({ id: 'real-review', cardId: reviewed.snapshot.cards[0].id, rating: 4, reviewedAt: '2026-11-09T12:00:00.000Z' });
  assert.equal(needsCloudBootstrap(connected, reviewed), false);
  const synced = local(); synced.base = structuredClone(synced.snapshot);
  assert.equal(needsCloudBootstrap(connected, synced), false);
  assert.equal(needsCloudBootstrap(connected, { snapshot: emptySnapshot(), base: emptySnapshot(), lastSyncedAt: null }), false);
});
