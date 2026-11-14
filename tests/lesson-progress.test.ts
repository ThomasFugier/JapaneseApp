import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeSnapshots } from '../lib/merge';
import { emptySnapshot, validateSnapshot } from '../lib/model';
import { setLessonValidated, validatedLessonIds } from '../lib/lesson-progress';
import { backupBytes, readBackup } from '../lib/portability';

const at = (minute: number) => `2026-11-14T10:${String(minute).padStart(2, '0')}:00.000Z`;

test('legacy snapshots without lesson progress stay valid and absent', () => {
  const snapshot = validateSnapshot(emptySnapshot());
  assert.equal('lessonProgress' in snapshot, false);
  assert.equal(validatedLessonIds(snapshot).length, 0);
});

test('manual completion writes an explicit validation record and ZIP round-trips it', () => {
  const snapshot = setLessonValidated(emptySnapshot(), 'comparisons', true, at(1));
  assert.deepEqual(validatedLessonIds(snapshot), ['comparisons']);
  assert.deepEqual(readBackup(backupBytes(snapshot)), snapshot);
});

test('latest validation or uncheck wins, while ties prefer unchecked', () => {
  const base = setLessonValidated(emptySnapshot(), 'comparisons', true, at(1));
  const checkedElsewhere = setLessonValidated(base, 'obligation', true, at(3));
  const uncheckedHere = setLessonValidated(base, 'comparisons', false, at(4));
  const merged = mergeSnapshots(base, checkedElsewhere, uncheckedHere).snapshot;
  assert.deepEqual(merged.lessonProgress, [
    { id: 'comparisons', validated: false, updatedAt: at(4) },
    { id: 'obligation', validated: true, updatedAt: at(3) },
  ]);

  const tiedChecked = validateSnapshot({ ...base, lessonProgress: [
    { id: 'comparisons', validated: true, updatedAt: '2026-11-14T12:05:00+02:00' },
  ] });
  const tiedOffsetUnchecked = validateSnapshot({ ...base, lessonProgress: [
    { id: 'comparisons', validated: false, updatedAt: '2026-11-14T10:05:00.000Z' },
  ] });
  assert.equal(mergeSnapshots(base, tiedChecked, tiedOffsetUnchecked).snapshot.lessonProgress?.[0].validated, false);
  assert.deepEqual(mergeSnapshots(base, tiedChecked, tiedOffsetUnchecked).snapshot.lessonProgress, mergeSnapshots(base, tiedOffsetUnchecked, tiedChecked).snapshot.lessonProgress);
});

test('rapid validation changes advance timestamps so a recheck wins', () => {
  const checked = setLessonValidated(emptySnapshot(), 'comparisons', true, at(5));
  const unchecked = setLessonValidated(checked, 'comparisons', false, at(5));
  const rechecked = setLessonValidated(unchecked, 'comparisons', true, at(5));
  assert.deepEqual(validatedLessonIds(rechecked), ['comparisons']);
  assert.equal(Date.parse(rechecked.lessonProgress![0].updatedAt), Date.parse(checked.lessonProgress![0].updatedAt) + 2);
});

test('merge retains progress missing from an old client, including false records and unknown IDs', () => {
  const oldClient = emptySnapshot();
  const base = validateSnapshot({ ...oldClient, lessonProgress: [
    { id: 'comparisons', validated: true, updatedAt: at(1) },
    { id: 'future-lesson', validated: true, updatedAt: at(2) },
  ] });
  const unchecked = setLessonValidated(base, 'comparisons', false, at(3));
  const merged = mergeSnapshots(base, oldClient, unchecked).snapshot;
  assert.deepEqual(merged.lessonProgress, [
    { id: 'comparisons', validated: false, updatedAt: at(3) },
    { id: 'future-lesson', validated: true, updatedAt: at(2) },
  ]);
  assert.deepEqual(validatedLessonIds(merged), []);
});

test('progress changes leave review and card data untouched', () => {
  const original = validateSnapshot(emptySnapshot());
  original.notes.push({ id: 'n', japanese: '本', reading: 'ほん', meaning: 'livre', example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: at(1), deletedAt: null });
  original.cards.push({ id: 'c', noteId: 'n', direction: 'ja-fr', deckIds: [], updatedAt: at(1), deletedAt: null });
  original.reviews.push({ id: 'r', cardId: 'c', rating: 3, reviewedAt: at(1) });
  const normalized = validateSnapshot(original);
  const before = { cards: structuredClone(normalized.cards), reviews: structuredClone(normalized.reviews) };
  const after = setLessonValidated(normalized, 'obligation', true, at(2));
  assert.deepEqual({ cards: after.cards, reviews: after.reviews }, before);
});
