import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySnapshot, validateSnapshot } from '../lib/model';
import { mergeSnapshots } from '../lib/merge';
import { lessonReviewOrder, markLessonReviewed, setLessonValidated } from '../lib/lesson-progress';

const early = '2026-11-14T10:00:00.000Z', late = '2026-11-14T11:00:00.000Z';
test('suggest never-reviewed lessons first, then the oldest review, independently of validation', () => {
  let data = setLessonValidated(emptySnapshot(), 'obligation', true, early);
  assert.deepEqual(lessonReviewOrder(data.lessonProgress), ['comparisons', 'obligation', 'wants', 'negative-adjectives']);
  data = markLessonReviewed(data, 'comparisons', early);
  assert.deepEqual(lessonReviewOrder(data.lessonProgress), ['obligation', 'wants', 'negative-adjectives', 'comparisons']);
  data = markLessonReviewed(data, 'obligation', late);
  assert.deepEqual(lessonReviewOrder(data.lessonProgress), ['wants', 'negative-adjectives', 'comparisons', 'obligation']);
  data = markLessonReviewed(data, 'comparisons', '2026-11-14T12:00:00.000Z');
  assert.deepEqual(lessonReviewOrder(data.lessonProgress), ['wants', 'negative-adjectives', 'obligation', 'comparisons']);
});
test('validation changes preserve review dates and review completion never checks a lesson', () => {
  const reviewed = markLessonReviewed(emptySnapshot(), 'comparisons', early);
  assert.equal(reviewed.lessonProgress![0].validated, false);
  const checked = setLessonValidated(reviewed, 'comparisons', true, late);
  const unchecked = setLessonValidated(checked, 'comparisons', false, late);
  assert.equal(unchecked.lessonProgress![0].lastReviewedAt, early);
  assert.deepEqual(checked.reviews, []);
  assert.deepEqual(checked.cards, []);
  assert.equal(markLessonReviewed(checked, 'comparisons', early).lessonProgress![0].updatedAt, late);
});
test('review completion and validation merge independently across devices in either order', () => {
  const base = emptySnapshot();
  const reviewed = markLessonReviewed(base, 'comparisons', late);
  const validated = setLessonValidated(base, 'comparisons', true, early);
  const merged = mergeSnapshots(base, reviewed, validated).snapshot;
  assert.deepEqual(merged.lessonProgress, [{ id: 'comparisons', validated: true, updatedAt: early, lastReviewedAt: late }]);
  assert.deepEqual(merged.lessonProgress, mergeSnapshots(base, validated, reviewed).snapshot.lessonProgress);
  const unchecked = setLessonValidated(merged, 'comparisons', false, '2026-11-14T13:00:00.000Z');
  const reread = markLessonReviewed(merged, 'comparisons', '2026-11-14T14:00:00.000Z');
  const result = mergeSnapshots(merged, unchecked, reread).snapshot.lessonProgress![0];
  assert.equal(result.validated, false);
  assert.equal(result.lastReviewedAt, '2026-11-14T14:00:00.000Z');
});
test('old clients and old validation-only records preserve the latest known review', () => {
  const base = markLessonReviewed(emptySnapshot(), 'obligation', late);
  const older = markLessonReviewed(emptySnapshot(), 'obligation', early);
  const result = mergeSnapshots(base, emptySnapshot(), older).snapshot;
  assert.equal(result.lessonProgress![0].lastReviewedAt, late);
  assert.equal(markLessonReviewed(base, 'obligation', early).lessonProgress![0].lastReviewedAt, late);
  assert.deepEqual(validateSnapshot(JSON.parse(JSON.stringify(result))), result);
});
