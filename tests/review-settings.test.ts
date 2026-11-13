import assert from 'node:assert/strict';
import test from 'node:test';
import { createReview, dueCards, ratingIntervals, scheduleForCard } from '../lib/engine';
import { mergeSnapshots } from '../lib/merge';
import { seedSnapshot } from '../lib/seed';
import { DEFAULT_REVIEW_SETTINGS } from '../lib/review-settings';
import { backupBytes, readBackup } from '../lib/portability';
import { validateSnapshot } from '../lib/model';

const now = new Date('2026-11-13T10:00:00.000Z');

test('Good repeats cap at twice its base; switching to Easy uses its own base', () => {
  const data = seedSnapshot();
  data.reviewSettings = { ...DEFAULT_REVIEW_SETTINGS, mode: 'custom', againMinutes: 1, hardMinutes: 1440, goodMinutes: 20160, easyMinutes: 86400 };
  assert.equal(createReview(data, 'card-taberu', 3, now, 'one').dueAt, '2026-11-27T10:00:00.000Z');
  data.reviews.push({ ...createReview(data, 'card-taberu', 3, now, 'one') });
  const later = new Date('2026-11-27T10:00:00.000Z');
  assert.equal(createReview(data, 'card-taberu', 3, later, 'repeat').dueAt, '2026-12-25T10:00:00.000Z');
  assert.equal(createReview(data, 'card-taberu', 4, later, 'two').dueAt, '2027-01-26T10:00:00.000Z');
  assert.equal(createReview(data, 'card-taberu', 2, later, 'hard').dueAt, '2026-11-28T10:00:00.000Z');
  assert.equal(createReview(data, 'card-taberu', 1, later, 'again').dueAt, '2026-11-27T10:01:00.000Z');
});

test('Easy intervals stay capped at three times its base, and Again resets the bonus', () => {
  const data = seedSnapshot();
  data.reviewSettings = { ...DEFAULT_REVIEW_SETTINGS, mode: 'custom', easyMinutes: 60 * 1440, goodMinutes: 14 * 1440 };
  let at = now;
  for (const [id, expected] of [['one', 60], ['two', 180], ['three', 180], ['four', 180]] as const) {
    const review = createReview(data, 'card-taberu', 4, at, id);
    assert.equal(Date.parse(review.dueAt!) - at.getTime(), expected * 86400000);
    data.reviews.push(review);
    at = new Date(review.dueAt!);
  }
  const again = createReview(data, 'card-taberu', 1, at, 'again');
  data.reviews.push(again);
  const nextEasy = createReview(data, 'card-taberu', 4, new Date(again.dueAt!), 'easy');
  assert.equal(Date.parse(nextEasy.dueAt!) - Date.parse(again.dueAt!), 60 * 86400000);
});

test('each answer change resets the bonus; previews and saved intervals agree', () => {
  const data = seedSnapshot();
  data.reviewSettings = { ...DEFAULT_REVIEW_SETTINGS, mode: 'custom' };
  let at = now;
  const steps = [[3, 14], [3, 28], [3, 28], [4, 60], [4, 180], [3, 14], [3, 28], [2, 1], [3, 14], [4, 60], [4, 180], [2, 1], [4, 60], [4, 180]] as const;
  for (const [index, [rating, days]] of steps.entries()) {
    assert.equal(ratingIntervals(data, 'card-taberu', at)[rating], `${days} d`);
    const review = createReview(data, 'card-taberu', rating, at, `step-${index}`);
    assert.equal(Date.parse(review.dueAt!) - at.getTime(), days * 86400000);
    data.reviews.push(review);
    at = new Date(review.dueAt!);
  }
});

test('repeat bonus ignores other directions and undone answers, and uses updated base settings', () => {
  const data = seedSnapshot();
  data.reviewSettings = { ...DEFAULT_REVIEW_SETTINGS, mode: 'custom' };
  data.reviews.push(createReview(data, 'card-taberu', 4, now, 'first'));
  const other = data.cards.find(card => card.noteId === data.cards.find(item => item.id === 'card-taberu')!.noteId && card.id !== 'card-taberu')!;
  data.reviews.push(createReview(data, other.id, 2, new Date(now.getTime() + 60000), 'reverse-hard'));
  const hardAt = new Date(now.getTime() + 120000);
  data.reviews.push(createReview(data, 'card-taberu', 2, hardAt, 'hard'));
  const later = new Date(now.getTime() + 180000);
  assert.equal(ratingIntervals(data, 'card-taberu', later)[4], '60 d');
  data.reviewUndos.push({ id: 'undo-hard', reviewId: 'hard', undoneAt: later.toISOString() });
  assert.equal(ratingIntervals(data, 'card-taberu', later)[4], '180 d');
  data.reviewSettings.easyMinutes = 90 * 1440;
  assert.equal(ratingIntervals(data, 'card-taberu', later)[4], '270 d');
  assert.equal(scheduleForCard(data, 'card-taberu').due.toISOString(), data.reviews[0].dueAt);
});

test('fixed intervals do not grow and preview matches created event', () => {
  const data = seedSnapshot();
  data.reviewSettings = { ...DEFAULT_REVIEW_SETTINGS, mode: 'custom', growIntervals: false };
  data.reviews.push(createReview(data, 'card-taberu', 4, new Date(now.getTime() - 86400000), 'previous'));
  const review = createReview(data, 'card-taberu', 4, now, 'fixed');
  assert.equal(review.dueAt, new Date(now.getTime() + data.reviewSettings.easyMinutes * 60000).toISOString());
  assert.equal(ratingIntervals(data, 'card-taberu', now)[4], '60 d');
});

test('saved custom due dates survive settings changes, undo and backup', () => {
  const data = seedSnapshot();
  data.reviewSettings = { ...DEFAULT_REVIEW_SETTINGS, mode: 'custom' };
  const review = createReview(data, 'card-taberu', 3, now, 'saved');
  data.reviews.push(review);
  const original = scheduleForCard(data, 'card-taberu');
  data.reviewSettings = { ...data.reviewSettings, goodMinutes: 2880, easyMinutes: 2880, hardMinutes: 1440, updatedAt: '2026-11-14T00:00:00.000Z' };
  assert.equal(scheduleForCard(data, 'card-taberu').due.toISOString(), review.dueAt);
  assert.deepEqual(readBackup(backupBytes(data)), validateSnapshot(data));
  data.reviewUndos.push({ id: 'undo', reviewId: 'saved', undoneAt: '2026-11-14T00:00:01.000Z' });
  assert.equal(scheduleForCard(data, 'card-taberu').reps, 0);
  assert.equal(original.reps, 1);
});

test('custom scheduling remains direction-local and prevents a custom review becoming due early', () => {
  const data = seedSnapshot();
  data.reviewSettings = { ...DEFAULT_REVIEW_SETTINGS, mode: 'custom' };
  const note = data.cards.find(card => card.id === 'card-taberu')!.noteId;
  const otherDirection = data.cards.find(card => card.noteId === note && card.id !== 'card-taberu')!;
  const review = createReview(data, 'card-taberu', 3, now, 'custom-forward');
  data.reviews.push(review);
  assert.equal(scheduleForCard(data, otherDirection.id).reps, 0);
  assert.ok(!dueCards(data, null, new Date(now.getTime() + 13 * 86400000)).some(card => card.id === 'card-taberu'));
  assert.ok(dueCards(data, null, new Date(review.dueAt!)).some(card => card.id === 'card-taberu'));
});

test('old reviews retain automatic replay after settings change', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'old', cardId: 'card-taberu', rating: 3, reviewedAt: now.toISOString() });
  const original = scheduleForCard(data, 'card-taberu');
  data.reviewSettings = { ...DEFAULT_REVIEW_SETTINGS, mode: 'custom', updatedAt: '2026-11-14T00:00:00.000Z' };
  assert.deepEqual(scheduleForCard(data, 'card-taberu'), original);
  assert.equal(createReview(data, 'card-taberu', 3, now, 'next').dueAt, '2026-12-11T10:00:00.000Z');
});

test('settings merge by baseline and latest UTC timestamp', () => {
  const base = seedSnapshot(), local = structuredClone(base), remote = structuredClone(base);
  local.reviewSettings = { ...local.reviewSettings, mode: 'custom', updatedAt: '2026-11-13T12:00:00+01:00' };
  remote.reviewSettings = { ...remote.reviewSettings, hardMinutes: 1441, updatedAt: '2026-11-13T11:30:00Z' };
  assert.deepEqual(mergeSnapshots(base, local, remote).snapshot.reviewSettings, remote.reviewSettings);
  const reversed = mergeSnapshots(base, remote, local).snapshot.reviewSettings;
  assert.deepEqual(reversed, remote.reviewSettings);
  assert.deepEqual(mergeSnapshots(base, base, remote).snapshot.reviewSettings, remote.reviewSettings);
  assert.deepEqual(mergeSnapshots(base, remote, base).snapshot.reviewSettings, remote.reviewSettings);
  const tieLocal = { ...local.reviewSettings, updatedAt: '2026-11-13T11:30:00Z' };
  const tieRemote = { ...remote.reviewSettings, updatedAt: '2026-11-13T11:30:00Z' };
  const tied = mergeSnapshots(base, { ...base, reviewSettings: tieLocal }, { ...base, reviewSettings: tieRemote }).snapshot.reviewSettings;
  assert.deepEqual(tied, tieRemote);
});

test('malformed settings and review deadlines are rejected', () => {
  const data = seedSnapshot();
  assert.throws(() => validateSnapshot({ ...data, reviewSettings: { ...data.reviewSettings, goodMinutes: 1 } }), /Again ≤ Hard ≤ Good ≤ Easy/);
  data.reviews.push({ id: 'invalid', cardId: 'card-taberu', rating: 3, reviewedAt: now.toISOString(), dueAt: now.toISOString() });
  assert.throws(() => validateSnapshot(data), /due date/);
});
