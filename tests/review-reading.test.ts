import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleCardReading } from '../lib/review-reading';
import { seedSnapshot } from '../lib/seed';
import { validateSnapshot } from '../lib/model';
import { backupBytes, readBackup } from '../lib/portability';
import { mergeSnapshots } from '../lib/merge';
import { updateNoteContent } from '../lib/note-edit';
import { advanceReviewSession, createReviewSession } from '../lib/review-session';

const now = '2026-11-16T10:00:00.000Z';

test('reading visibility toggles independently for each card and preserves review progress', () => {
  const data = seedSnapshot(), before = structuredClone(data);
  const shown = toggleCardReading(data, 'card-taberu', now);
  assert.equal(shown.cards.find(card => card.id === 'card-taberu')?.showReading, true);
  assert.ok(shown.cards.filter(card => card.id !== 'card-taberu').every(card => !card.showReading));
  assert.deepEqual(shown.reviews, data.reviews);
  assert.deepEqual(shown.reviewUndos, data.reviewUndos);
  assert.deepEqual(shown.cards.map(({ showReading, updatedAt, ...card }) => card), data.cards.map(({ showReading, updatedAt, ...card }) => card));
  const hidden = toggleCardReading(shown, 'card-taberu', now);
  assert.equal(hidden.cards.find(card => card.id === 'card-taberu')?.showReading, false);
  assert.deepEqual(data, before);
});

test('visibility survives backup, synchronization, note edits and later review sessions', () => {
  const base = seedSnapshot();
  const shown = toggleCardReading(base, 'card-taberu', now);
  const restored = readBackup(backupBytes(shown));
  assert.equal(restored.cards.find(card => card.id === 'card-taberu')?.showReading, true);
  const merged = mergeSnapshots(base, base, restored);
  assert.equal(merged.conflicts.length, 0);
  const note = merged.snapshot.notes.find(item => item.id === 'note-taberu')!;
  const edited = updateNoteContent(merged.snapshot, { ...note, meaning: 'eat', updatedAt: now });
  assert.equal(edited.cards.find(card => card.id === 'card-taberu')?.showReading, true);
  const session = createReviewSession(edited, null, true, new Date(now))!;
  advanceReviewSession(session, edited, null, new Date(now));
  assert.equal(edited.cards.find(card => card.id === 'card-taberu')?.showReading, true);
  assert.equal(session.revealed, false);
  const hidden = toggleCardReading(restored, 'card-taberu', now);
  assert.equal(readBackup(backupBytes(hidden)).cards.find(card => card.id === 'card-taberu')?.showReading, false);
});

test('legacy cards stay hidden and invalid values or unavailable cards are rejected', () => {
  const data = seedSnapshot();
  assert.ok(validateSnapshot(data).cards.every(card => !card.showReading));
  assert.throws(() => validateSnapshot({ ...data, cards: data.cards.map(card => ({ ...card, showReading: 'yes' })) }));
  assert.throws(() => toggleCardReading(data, 'missing', now), /no longer available/);
  const reverse = data.cards.find(card => card.direction === 'fr-ja')!;
  assert.throws(() => toggleCardReading(data, reverse.id, now), /Japanese prompts/);
  const removed = structuredClone(data);
  removed.notes.find(note => note.id === 'note-taberu')!.deletedAt = now;
  assert.throws(() => toggleCardReading(removed, 'card-taberu', now), /no longer available/);
});
