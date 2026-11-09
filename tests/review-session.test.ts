import test from 'node:test';
import assert from 'node:assert/strict';
import { dueCards, effectiveReviews, scheduleForCard } from '../lib/engine';
import { advanceReviewSession, createReviewSession, rewindReviewSession, type ReviewSession } from '../lib/review-session';
import { seedSnapshot } from '../lib/seed';

const now = new Date('2026-11-09T10:00:00.000Z');
const session = (ids: string[]): ReviewSession => ({ deckId: null, ids, index: 0, revealed: true, practice: false, answers: [] });

test('a successful Easy answer leaves the remaining session until its next due date', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'easy', cardId: 'card-taberu', rating: 4, reviewedAt: now.toISOString() });
  const next = advanceReviewSession(session(['card-taberu']), data, 'easy', now);
  assert.equal(next.ids[0], 'card-taberu');
  assert.equal(next.index, 1);
  assert.equal(next.revealed, false);
  assert.ok(!next.ids.slice(next.index).includes('card-taberu'));
  assert.notEqual(data.cards.find(card => card.id === next.ids[next.index])!.noteId, 'note-taberu');
});

test('Again returns once due after the unseen cards have been studied', () => {
  const data = seedSnapshot();
  const fresh = new Set(['card-taberu', 'card-nomu', 'card-mizu', 'card-yomu']);
  data.reviews = data.cards.filter(card => !fresh.has(card.id)).map(card => ({ id: `known-${card.id}`, cardId: card.id, rating: 4 as const, reviewedAt: '2026-11-08T10:00:00.000Z' }));
  data.reviews.push({ id: 'again', cardId: 'card-taberu', rating: 1, reviewedAt: now.toISOString() });
  let current = advanceReviewSession(session(['card-taberu']), data, 'again', now);
  assert.ok(!current.ids.slice(current.index).includes('card-taberu'));
  for (let i = 0; i < 3; i++) {
    const time = new Date(now.getTime() + 120000 + i * 1000);
    const cardId = current.ids[current.index];
    assert.notEqual(cardId, 'card-taberu');
    data.reviews.push({ id: `other-${i}`, cardId, rating: 4, reviewedAt: time.toISOString() });
    current = advanceReviewSession(current, data, `other-${i}`, time);
  }
  assert.equal(current.ids[current.index], 'card-taberu');
  assert.equal(current.answers.length, 4);
});

test('learning deadlines that become due are added to a running session', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'good', cardId: 'card-taberu', rating: 3, reviewedAt: now.toISOString() });
  const first = advanceReviewSession(session(['card-taberu']), data, 'good', now);
  assert.ok(!first.ids.slice(first.index).includes('card-taberu'));
  const later = new Date(scheduleForCard(data, 'card-taberu').due.getTime() + 1);
  const cardId = first.ids[first.index];
  data.reviews.push({ id: 'next', cardId, rating: 4, reviewedAt: later.toISOString() });
  const next = advanceReviewSession(first, data, 'next', later);
  assert.ok(next.ids.slice(next.index).includes('card-taberu'));
  assert.ok(!next.ids.slice(next.index).includes(cardId));
});

test('a newly due failed card stays behind unseen cards during the running session', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'again', cardId: 'card-taberu', rating: 1, reviewedAt: now.toISOString() });
  const first = advanceReviewSession(session(['card-taberu']), data, 'again', now);
  const cardId = first.ids[first.index], later = new Date(now.getTime() + 120000);
  data.reviews.push({ id: 'easy', cardId, rating: 4, reviewedAt: later.toISOString() });
  const next = advanceReviewSession(first, data, 'easy', later);
  const remaining = next.ids.slice(next.index);
  assert.equal(scheduleForCard(data, remaining[0]).reps, 0);
  assert.equal(remaining.at(-1), 'card-taberu');
});

test('free practice keeps its fixed order and does not change review history', () => {
  const data = seedSnapshot(), before = structuredClone(data);
  const current = { ...session(['card-taberu', 'card-nomu']), practice: true };
  const next = advanceReviewSession(current, data, null, now);
  assert.deepEqual(next.ids, current.ids);
  assert.equal(next.index, 1);
  assert.equal(next.answers[0].reviewId, null);
  assert.deepEqual(data, before);
});

test('a one-word deck continues in free practice when both directions are scheduled in the future', () => {
  const data = seedSnapshot();
  data.notes = data.notes.filter(note => note.id === 'note-taberu');
  data.cards = data.cards.filter(card => card.noteId === 'note-taberu');
  let current = session(dueCards(data, null, now).map(card => card.id));
  for (let i = 0; i < 2; i++) {
    const id = `easy-${i}`;
    data.reviews.push({ id, cardId: current.ids[current.index], rating: 4, reviewedAt: now.toISOString() });
    current = advanceReviewSession(current, data, id, now);
  }
  assert.ok(current.index < current.ids.length);
  assert.equal(current.practice, true);
  assert.equal(current.answers.length, 2);
  assert.equal(dueCards(data, null, now).length, 0);
});

test('undo and a replacement answer preserve the completed prefix and event history', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'first', cardId: 'card-taberu', rating: 4, reviewedAt: now.toISOString() });
  const first = advanceReviewSession(session(['card-taberu']), data, 'first', now);
  const secondId = first.ids[first.index];
  data.reviews.push({ id: 'second', cardId: secondId, rating: 4, reviewedAt: now.toISOString() });
  const second = advanceReviewSession(first, data, 'second', now);
  data.reviewUndos.push({ id: 'undo-second', reviewId: 'second', undoneAt: now.toISOString() });
  const undone = { ...second, index: first.index, revealed: true, answers: second.answers.slice(0, -1) };
  assert.equal(undone.ids[undone.index], secondId);
  data.reviews.push({ id: 'replacement', cardId: secondId, rating: 1, reviewedAt: now.toISOString() });
  const redone = advanceReviewSession(undone, data, 'replacement', now);
  assert.deepEqual(redone.ids.slice(0, redone.index), first.ids.slice(0, first.index + 1));
  assert.deepEqual(redone.answers.map(answer => answer.reviewId), ['first', 'replacement']);
  assert.deepEqual(effectiveReviews(data, secondId).map(review => review.id), ['replacement']);
  assert.equal(data.reviews.length, 3);
});

test('an up-to-date deck starts directly in free practice without changing its schedules', () => {
  const data = seedSnapshot();
  data.reviews = data.cards.map(card => ({ id: `known-${card.id}`, cardId: card.id, rating: 4 as const, reviewedAt: '2026-11-08T10:00:00.000Z' }));
  const before = structuredClone(data), current = createReviewSession(data, null, false, now)!;
  assert.equal(current.practice, true);
  assert.equal(current.freeOnly, false);
  assert.equal(current.ids.length, data.cards.length);
  assert.deepEqual(data, before);
});

test('free practice continues across many cycles inside the selected subdeck without recording answers', () => {
  const data = seedSnapshot(), before = structuredClone(data);
  const expected = new Set(data.cards.filter(card => card.deckIds.includes('kanjis')).map(card => card.id));
  let current = createReviewSession(data, 'kanjis', true, now)!;
  let previousNote: string | undefined;
  let cycle: string[] = [];
  for (let step = 0; step < 100; step++) {
    const id = current.ids[current.index], card = data.cards.find(item => item.id === id)!;
    assert.ok(expected.has(id));
    assert.notEqual(card.noteId, previousNote);
    previousNote = card.noteId;
    cycle.push(id);
    if (cycle.length === expected.size) { assert.deepEqual(new Set(cycle), expected); cycle = []; }
    current = advanceReviewSession(current, data, null, now);
    assert.equal(current.practice, true);
    assert.ok(current.index < current.ids.length);
  }
  assert.ok(current.answers.every(answer => answer.reviewId === null));
  assert.deepEqual(data, before);
});

test('regular review resumes when a learning card becomes due during automatic free practice', () => {
  const data = seedSnapshot();
  data.notes = data.notes.filter(note => note.id === 'note-taberu');
  data.cards = data.cards.filter(card => card.noteId === 'note-taberu');
  let current = createReviewSession(data, null, false, now)!;
  const failed = current.ids[current.index];
  data.reviews.push({ id: 'again', cardId: failed, rating: 1, reviewedAt: now.toISOString() });
  current = advanceReviewSession(current, data, 'again', now);
  const other = current.ids[current.index];
  data.reviews.push({ id: 'easy', cardId: other, rating: 4, reviewedAt: now.toISOString() });
  current = advanceReviewSession(current, data, 'easy', now);
  assert.equal(current.practice, true);
  const before = structuredClone(data);
  current = advanceReviewSession(current, data, null, new Date(now.getTime() + 120000));
  assert.equal(current.practice, false);
  assert.equal(current.ids[current.index], failed);
  assert.deepEqual(data, before);
});

test('explicit free practice remains stateless even when graded reviews are available', () => {
  const data = seedSnapshot(), current = createReviewSession(data, null, true, now)!;
  assert.equal(dueCards(data, null, now).length, data.cards.length);
  const next = advanceReviewSession(current, data, null, now);
  assert.equal(next.practice, true);
  assert.equal(next.freeOnly, true);
  assert.equal(data.reviews.length, 0);
});

test('undo restores grading controls when the previous answer entered free practice', () => {
  const data = seedSnapshot();
  data.notes = data.notes.filter(note => note.id === 'note-taberu');
  data.cards = data.cards.filter(card => card.noteId === 'note-taberu');
  let current = createReviewSession(data, null, false, now)!;
  for (let step = 0; step < 2; step++) {
    const id = `answer-${step}`;
    data.reviews.push({ id, cardId: current.ids[current.index], rating: 4, reviewedAt: now.toISOString() });
    current = advanceReviewSession(current, data, id, now);
  }
  assert.equal(current.practice, true);
  const previous = current.answers.at(-1)!;
  const undone = rewindReviewSession(current);
  assert.equal(undone.practice, false);
  assert.equal(undone.revealed, true);
  assert.equal(undone.index, previous.index);
  assert.equal(undone.ids[undone.index], current.ids[previous.index]);
  const practiced = advanceReviewSession(current, data, null, now);
  assert.equal(rewindReviewSession(practiced).practice, true);
});

test('empty or missing deck scopes never fall back to unrelated cards', () => {
  const data = seedSnapshot();
  assert.equal(createReviewSession(data, 'missing', false, now), null);
  data.cards = [];
  assert.equal(createReviewSession(data, null, true, now), null);
});
