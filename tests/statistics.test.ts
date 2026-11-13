import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyCard, fsrs, type Grade } from 'ts-fsrs';
import { emptySnapshot, type Review, type Snapshot } from '../lib/model';
import { buildStatistics } from '../lib/statistics';
import { createReview, scheduleForCard } from '../lib/engine';

const stamp = '2026-01-01T00:00:00.000Z';

function fixture(): Snapshot {
  const data = emptySnapshot();
  data.decks = [
    { id: 'root', parentId: null },
    { id: 'child', parentId: 'root' },
    { id: 'grandchild', parentId: 'child' },
    { id: 'outside', parentId: null },
  ].map(deck => ({ ...deck, name: deck.id, description: '', color: 'sage', updatedAt: stamp }));
  data.notes = ['n1', 'n2', 'n3'].map(id => ({
    id, japanese: id, reading: '', meaning: id, example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: stamp,
  }));
  data.cards = data.notes.flatMap(note => (['ja-fr', 'fr-ja'] as const).map(direction => ({
    id: `${note.id}-${direction}`, noteId: note.id, direction, deckIds: ['root'], updatedAt: stamp,
  })));
  return data;
}

function review(data: Snapshot, id: string, cardId: string, rating: Review['rating'], reviewedAt: string | Date): void {
  data.reviews.push({ id, cardId, rating, reviewedAt: typeof reviewedAt === 'string' ? reviewedAt : reviewedAt.toISOString() });
}

test('statistics share saved custom deadlines with review, including preference changes and undo', () => {
  const data = fixture(), now = new Date('2026-11-13T12:00:00.000Z');
  data.reviewSettings = { ...data.reviewSettings, mode: 'custom' };
  const first = createReview(data, 'n1-ja-fr', 3, now, 'first');
  data.reviews.push(first);
  const later = new Date(first.dueAt!);
  const second = createReview(data, 'n1-ja-fr', 4, later, 'second');
  data.reviews.push(second);
  data.reviewSettings = { ...data.reviewSettings, mode: 'automatic' };
  const direction = () => buildStatistics(data, later).cards[0].directions.find(item => item.cardId === 'n1-ja-fr')!;
  assert.equal(direction().nextDueAt, second.dueAt);
  assert.equal(direction().nextDueAt, scheduleForCard(data, 'n1-ja-fr').due.toISOString());
  data.reviewUndos.push({ id: 'undo-second', reviewId: second.id, undoneAt: later.toISOString() });
  assert.equal(direction().nextDueAt, first.dueAt);
  assert.equal(direction().nextDueAt, scheduleForCard(data, 'n1-ja-fr').due.toISOString());
});

test('empty and unknown scopes have null recall and zero-filled activity', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');
  for (const stats of [buildStatistics(emptySnapshot(), now), buildStatistics(fixture(), now, 'missing')]) {
    assert.equal(stats.totalCards, 0);
    assert.equal(stats.studiedCards, 0);
    assert.equal(stats.newCards, 0);
    assert.equal(stats.dueCards, 0);
    assert.equal(stats.estimatedRecall, null);
    assert.equal(stats.periodReviews, 0);
    assert.equal(stats.periodActiveDays, 0);
    assert.deepEqual(stats.ratings, { 1: 0, 2: 0, 3: 0, 4: 0 });
    assert.equal(stats.activity.length, 30);
    assert.ok(stats.activity.every(day => day.count === 0));
  }
});

test('independent directions produce exclusive word counts and distinct recall estimates', () => {
  const data = fixture(), now = new Date('2026-11-10T12:00:00.000Z');
  review(data, 'n1-known', 'n1-ja-fr', 4, '2026-11-09T12:00:00.000Z');
  review(data, 'n1-again', 'n1-fr-ja', 1, '2026-11-10T11:55:00.000Z');
  review(data, 'n2-known', 'n2-ja-fr', 4, '2026-11-08T12:00:00.000Z');
  const before = structuredClone(data);
  const stats = buildStatistics(data, now);
  assert.equal(stats.totalCards, 3);
  assert.equal(stats.studiedCards, 2);
  assert.equal(stats.newCards, 1);
  assert.equal(stats.oneDirectionCards, 1);
  assert.equal(stats.bothDirectionCards, 1);
  const [both, one, unseen] = stats.cards;
  assert.equal(both.studiedDirections, 2);
  assert.equal(both.reviewCount, 2);
  assert.equal(both.againCount, 1);
  assert.equal(both.lastReviewedAt, '2026-11-10T11:55:00.000Z');
  assert.deepEqual(both.directions.map(direction => direction.lastRating), [4, 1]);
  assert.equal(both.recall, Math.min(...both.directions.map(direction => direction.recall!)));
  assert.equal(one.directions[1].recall, null);
  assert.equal(one.directions[1].nextDueAt, null);
  assert.equal(one.directions[1].state, 'new');
  assert.equal(one.recall, one.directions[0].recall);
  assert.equal(unseen.recall, null);
  const recalls = [...both.directions, ...one.directions].flatMap(direction => direction.recall === null ? [] : [direction.recall]);
  assert.equal(stats.estimatedRecall, recalls.reduce((sum, recall) => sum + recall, 0) / 3);
  assert.deepEqual(data, before);
});

test('undone, deleted, missing and future review events are excluded everywhere', () => {
  const data = fixture(), now = new Date('2026-11-10T12:00:00.000Z');
  data.cards.find(card => card.id === 'n2-ja-fr')!.deletedAt = stamp;
  data.notes.find(note => note.id === 'n3')!.deletedAt = stamp;
  review(data, 'active', 'n1-ja-fr', 4, '2026-11-10T10:00:00.000Z');
  review(data, 'undone', 'n1-fr-ja', 1, '2026-11-10T10:01:00.000Z');
  review(data, 'deleted-card', 'n2-ja-fr', 1, '2026-11-10T10:02:00.000Z');
  review(data, 'deleted-note', 'n3-ja-fr', 1, '2026-11-10T10:03:00.000Z');
  review(data, 'missing-card', 'missing', 1, '2026-11-10T10:04:00.000Z');
  review(data, 'future', 'n1-ja-fr', 1, '2026-11-10T12:00:00.001Z');
  data.reviewUndos.push({ id: 'undo', reviewId: 'undone', undoneAt: '2026-11-10T10:02:00.000Z' });
  const stats = buildStatistics(data, now);
  assert.equal(stats.totalCards, 2);
  assert.equal(stats.studiedCards, 1);
  assert.equal(stats.newCards, 1);
  assert.equal(stats.periodReviews, 1);
  assert.deepEqual(stats.ratings, { 1: 0, 2: 0, 3: 0, 4: 1 });
  assert.deepEqual(stats.cards[0].history.map(event => event.id), ['active']);
  assert.equal(stats.cards[0].directions[0].lastRating, 4);
  assert.equal(stats.cards[0].directions[1].reviewCount, 0);
  assert.equal(stats.cards[1].directions.length, 1);
  assert.equal(stats.cards[1].recall, null);
});

test('deck scope includes descendants and counts shared memberships once', () => {
  const data = fixture(), now = new Date('2026-11-10T12:00:00.000Z');
  for (const card of data.cards) card.deckIds = card.noteId === 'n1' ? ['root', 'child', 'grandchild'] : card.noteId === 'n2' ? ['grandchild'] : ['outside'];
  review(data, 'shared', 'n1-ja-fr', 3, now);
  review(data, 'nested', 'n2-fr-ja', 2, now);
  review(data, 'outside', 'n3-ja-fr', 1, now);
  const stats = buildStatistics(data, now, 'root');
  assert.equal(stats.totalCards, 2);
  assert.equal(stats.periodReviews, 2);
  assert.equal(stats.activity.at(-1)!.count, 2);
  assert.deepEqual(stats.ratings, { 1: 0, 2: 1, 3: 1, 4: 0 });
  assert.equal(buildStatistics(data, now, 'child').periodReviews, 2);
  assert.equal(buildStatistics(data, now).periodReviews, 3);
  data.decks.find(deck => deck.id === 'child')!.deletedAt = stamp;
  assert.deepEqual(buildStatistics(data, now, 'child').cards, []);
  assert.deepEqual(buildStatistics(data, now, 'root').cards.map(card => card.note.id), ['n1']);
});

test('activity uses local calendar boundaries through DST and includes today through now', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Paris';
  try {
    const data = fixture(), now = new Date(2026, 9, 27, 12);
    const firstDay = new Date(2026, 9, 21);
    review(data, 'outside-window', 'n1-ja-fr', 4, new Date(firstDay.getTime() - 1));
    review(data, 'window-start', 'n1-ja-fr', 3, firstDay);
    review(data, 'dst-first-hour', 'n1-fr-ja', 3, '2026-10-25T00:30:00.000Z');
    review(data, 'dst-second-hour', 'n1-fr-ja', 2, '2026-10-25T01:30:00.000Z');
    review(data, 'today-midnight', 'n2-ja-fr', 4, new Date(2026, 9, 27));
    review(data, 'now', 'n2-fr-ja', 1, now);
    review(data, 'future-today', 'n2-fr-ja', 4, new Date(now.getTime() + 1));
    const stats = buildStatistics(data, now, null, 7);
    assert.deepEqual(stats.activity, [
      { date: '2026-10-21', count: 1 },
      { date: '2026-10-22', count: 0 },
      { date: '2026-10-23', count: 0 },
      { date: '2026-10-24', count: 0 },
      { date: '2026-10-25', count: 2 },
      { date: '2026-10-26', count: 0 },
      { date: '2026-10-27', count: 2 },
    ]);
    assert.equal(stats.periodReviews, 5);
    assert.equal(stats.periodActiveDays, 3);
    assert.deepEqual(stats.ratings, { 1: 1, 2: 1, 3: 2, 4: 1 });
    assert.equal(stats.cards[0].reviewCount, 4);
    assert.equal(buildStatistics(data, now, null, 30).activity.length, 30);
    assert.equal(buildStatistics(data, now, null, 90).activity.length, 90);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('recall matches installed FSRS without rounding and decreases with elapsed time', () => {
  const data = fixture();
  review(data, 'easy', 'n1-ja-fr', 4, '2026-11-01T12:00:00.000Z');
  review(data, 'good', 'n1-ja-fr', 3, '2026-11-08T12:00:00.000Z');
  const scheduler = fsrs({ request_retention: data.scheduler.retention, enable_fuzz: false });
  let schedule = createEmptyCard(new Date(0));
  for (const event of data.reviews) schedule = scheduler.next(schedule, new Date(event.reviewedAt), event.rating as Grade).card;
  const earlier = new Date('2026-11-09T12:00:00.000Z'), later = new Date('2026-11-20T12:00:00.000Z');
  const first = buildStatistics(data, earlier).cards[0].directions[0];
  const second = buildStatistics(data, later).cards[0].directions[0];
  assert.equal(first.recall, scheduler.get_retrievability(schedule, earlier, false));
  assert.equal(second.recall, scheduler.get_retrievability(schedule, later, false));
  assert.ok(second.recall! < first.recall!);
  assert.equal(second.nextDueAt, schedule.due.toISOString());
  assert.equal(second.state, 'review');
});

test('learning and relearning recall remain estimates while Again and lapses mark weaknesses', () => {
  const data = fixture(), now = new Date('2026-11-10T12:00:00.000Z');
  review(data, 'learning-again', 'n1-ja-fr', 1, now);
  review(data, 'graduated', 'n2-ja-fr', 4, '2026-11-01T12:00:00.000Z');
  review(data, 'lapse', 'n2-ja-fr', 1, '2026-11-10T11:59:00.000Z');
  review(data, 'relearning-hard', 'n2-ja-fr', 2, now);
  const stats = buildStatistics(data, now);
  const learning = stats.cards[0], relearning = stats.cards[1];
  assert.equal(learning.directions[0].state, 'learning');
  assert.equal(learning.directions[0].recall, 1);
  assert.equal(learning.weak, true);
  assert.equal(relearning.directions[0].state, 'relearning');
  assert.equal(relearning.directions[0].recall, 1);
  assert.equal(relearning.directions[0].lapses, 1);
  assert.equal(relearning.directions[0].lastRating, 2);
  assert.equal(relearning.weak, true);
  assert.equal(stats.cards[2].weak, false);
});

test('low recall is weak even when the last answer was Easy', () => {
  const data = fixture();
  review(data, 'old', 'n1-ja-fr', 4, '2026-01-01T00:00:00.000Z');
  const stats = buildStatistics(data, new Date('2026-11-10T12:00:00.000Z'));
  assert.equal(stats.cards[0].directions[0].lastRating, 4);
  assert.ok(stats.cards[0].recall! < 0.8);
  assert.equal(stats.cards[0].weak, true);
});

test('due words exclude unseen directions and become due exactly at their scheduled time', () => {
  const data = fixture(), now = new Date('2026-11-10T12:00:00.000Z');
  const unseen = buildStatistics(data, now);
  assert.equal(unseen.dueCards, 0);
  assert.ok(unseen.cards.every(card => !card.due && card.nextDueAt === null));
  review(data, 'easy', 'n1-ja-fr', 4, now);
  const current = buildStatistics(data, now);
  const due = new Date(current.cards[0].nextDueAt!);
  assert.ok(due.getTime() > now.getTime());
  assert.equal(current.dueCards, 0);
  assert.equal(current.cards[0].weak, false);
  assert.equal(current.cards[0].directions[1].nextDueAt, null);
  assert.equal(buildStatistics(data, new Date(due.getTime() - 1)).dueCards, 0);
  assert.equal(buildStatistics(data, due).dueCards, 1);
});

test('history caps only details and sorts equal-time reviews deterministically', () => {
  const data = fixture(), now = new Date('2026-11-10T12:00:00.000Z');
  for (let index = 0; index < 16; index++) {
    review(data, `r-${index.toString().padStart(2, '0')}`, index % 2 ? 'n1-fr-ja' : 'n1-ja-fr', index % 4 === 0 ? 1 : 3, now);
  }
  data.cards.reverse();
  data.notes.reverse();
  data.reviews.reverse();
  const stats = buildStatistics(data, now);
  const card = stats.cards[0];
  assert.equal(card.reviewCount, 16);
  assert.equal(card.againCount, 4);
  assert.equal(stats.periodReviews, 16);
  assert.equal(card.history.length, 12);
  assert.deepEqual(card.history.map(event => event.id), Array.from({ length: 12 }, (_, index) => `r-${(15 - index).toString().padStart(2, '0')}`));
  assert.deepEqual(card.directions.map(direction => direction.direction), ['ja-fr', 'fr-ja']);
  assert.deepEqual(card.directions.map(direction => direction.reviewCount), [8, 8]);
  const reversed = structuredClone(data);
  reversed.reviews.reverse();
  reversed.cards.reverse();
  reversed.notes.reverse();
  assert.deepEqual(buildStatistics(reversed, now), stats);
});

test('editing note text preserves its review history and every derived progress metric', () => {
  const data = fixture(), now = new Date('2026-11-10T12:00:00.000Z');
  review(data, 'known', 'n1-ja-fr', 4, '2026-11-01T12:00:00.000Z');
  review(data, 'remembered', 'n1-ja-fr', 3, '2026-11-08T12:00:00.000Z');
  review(data, 'again', 'n1-fr-ja', 1, '2026-11-10T11:55:00.000Z');
  review(data, 'hard', 'n1-fr-ja', 2, '2026-11-10T11:59:00.000Z');
  review(data, 'one-direction', 'n2-ja-fr', 4, '2026-11-09T12:00:00.000Z');
  const before = structuredClone(buildStatistics(data, now));
  Object.assign(data.notes.find(note => note.id === 'n1')!, {
    japanese: '日本語', meaning: 'japonais', reading: 'にほんご', updatedAt: now.toISOString(),
  });
  const after = buildStatistics(data, now);
  const { note: originalNote, ...originalProgress } = before.cards[0];
  const { note: editedNote, ...editedProgress } = after.cards[0];
  assert.notDeepEqual(editedNote, originalNote);
  assert.deepEqual(editedProgress, originalProgress);
  assert.equal(after.estimatedRecall, before.estimatedRecall);
  assert.equal(after.periodReviews, before.periodReviews);
  for (const stats of [before, after]) {
    const recalls = [stats.estimatedRecall, ...stats.cards.flatMap(card => [card.recall, ...card.directions.map(direction => direction.recall)])];
    assert.ok(recalls.every(value => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)));
    assert.equal(stats.cards[2].recall, null);
    assert.equal(stats.cards[1].directions[1].recall, null);
  }
});
