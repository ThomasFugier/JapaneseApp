import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveReviews, scheduleForCard } from '../lib/engine';
import { mergeSnapshots } from '../lib/merge';
import { emptySnapshot, validateSnapshot, type Snapshot, type StudyCard } from '../lib/model';

const originalTime = '2026-11-01T00:00:00.000Z';
const laterTime = '2026-11-02T00:00:00.000Z';
const newestTime = '2026-11-03T00:00:00.000Z';

function singleDirection(noteId = 'note-kana'): Snapshot {
  const data = emptySnapshot();
  data.decks = ['a', 'b', 'c'].map((id) => ({ id, name: id, description: '', parentId: null, color: 'sage', updatedAt: originalTime }));
  data.notes = [{ id: noteId, japanese: '仮名', reading: 'かな', meaning: 'Kana', example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: originalTime }];
  data.cards = [{ id: 'original-forward', noteId, direction: 'ja-fr', deckIds: ['a'], updatedAt: originalTime }];
  return data;
}

function direction(data: Snapshot, value: StudyCard['direction'], noteId = data.notes[0].id): StudyCard {
  const cards = data.cards.filter((card) => card.noteId === noteId && card.direction === value && !card.deletedAt);
  assert.equal(cards.length, 1);
  return cards[0];
}

test('legacy and current snapshots deterministically gain both directions without mutating input', () => {
  for (const schemaVersion of [1, 2, 3]) {
    const input = { ...singleDirection(), schemaVersion };
    const original = structuredClone(input);
    const migrated = validateSnapshot(input);
    assert.equal(migrated.schemaVersion, 3);
    assert.equal(migrated.cards.length, 2);
    assert.deepEqual(direction(migrated, 'ja-fr'), original.cards[0]);
    assert.deepEqual(direction(migrated, 'fr-ja').deckIds, ['a']);
    assert.equal(direction(migrated, 'fr-ja').updatedAt, originalTime);
    assert.deepEqual(input, original);
    assert.deepEqual(validateSnapshot(input), migrated);
    assert.deepEqual(validateSnapshot(migrated), migrated);
  }
});

test('each direction retains its own FSRS history, review events and undos', () => {
  const original = singleDirection();
  original.reviews = [
    { id: 'forward-first', cardId: 'original-forward', rating: 3, reviewedAt: originalTime },
    { id: 'forward-undone', cardId: 'original-forward', rating: 1, reviewedAt: laterTime },
  ];
  original.reviewUndos = [{ id: 'undo-forward', reviewId: 'forward-undone', undoneAt: newestTime }];
  const forwardSchedule = scheduleForCard(original, 'original-forward');
  const data = validateSnapshot(original);
  const reverse = direction(data, 'fr-ja');
  assert.deepEqual(data.reviews, original.reviews);
  assert.deepEqual(data.reviewUndos, original.reviewUndos);
  assert.deepEqual(scheduleForCard(data, 'original-forward'), forwardSchedule);
  assert.equal(scheduleForCard(data, reverse.id).reps, 0);
  data.reviews.push({ id: 'reverse-answer', cardId: reverse.id, rating: 4, reviewedAt: laterTime });
  assert.equal(scheduleForCard(data, reverse.id).reps, 1);
  assert.deepEqual(scheduleForCard(data, 'original-forward'), forwardSchedule);
  data.reviewUndos.push({ id: 'undo-reverse', reviewId: 'reverse-answer', undoneAt: newestTime });
  assert.equal(scheduleForCard(data, reverse.id).reps, 0);
  assert.equal(effectiveReviews(data, 'original-forward').length, 1);
  assert.deepEqual(scheduleForCard(data, 'original-forward'), forwardSchedule);
  assert.deepEqual(validateSnapshot(data).reviews, data.reviews);
});

test('independent device migrations share direction IDs and merge review histories once', () => {
  const base = singleDirection();
  const left = validateSnapshot(base);
  const right = validateSnapshot(structuredClone(base));
  const reverseId = direction(left, 'fr-ja').id;
  assert.equal(direction(right, 'fr-ja').id, reverseId);
  left.reviews.push({ id: 'left-forward', cardId: 'original-forward', rating: 3, reviewedAt: originalTime });
  right.reviews.push({ id: 'right-reverse', cardId: reverseId, rating: 4, reviewedAt: laterTime });
  const merged = mergeSnapshots(base, left, right);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.snapshot.cards.length, 2);
  assert.equal(scheduleForCard(merged.snapshot, 'original-forward').reps, 1);
  assert.equal(scheduleForCard(merged.snapshot, reverseId).reps, 1);
  const repeated = mergeSnapshots(base, merged.snapshot, right).snapshot;
  assert.deepEqual(repeated, merged.snapshot);
  assert.deepEqual(validateSnapshot(repeated), repeated);
  const legacySync = mergeSnapshots(base, base, base).snapshot;
  assert.equal(direction(legacySync, 'fr-ja').id, reverseId);
});

test('archived notes remain archived while an active note with no cards gains a pair', () => {
  const data = singleDirection();
  data.notes[0].deletedAt = laterTime;
  data.cards[0].deletedAt = laterTime;
  data.notes.push({ ...data.notes[0], id: 'archived-empty' });
  data.notes.push({ ...data.notes[0], id: 'active-empty', deletedAt: undefined });
  const result = validateSnapshot(data);
  assert.deepEqual(result.cards.find((card) => card.id === 'original-forward'), data.cards[0]);
  assert.equal(result.cards.filter((card) => card.noteId === data.notes[0].id).length, 1);
  assert.equal(result.cards.filter((card) => card.noteId === 'archived-empty').length, 0);
  for (const value of ['ja-fr', 'fr-ja'] as const) assert.deepEqual(direction(result, value, 'active-empty').deckIds, []);
  assert.deepEqual(result.notes, data.notes);
  assert.deepEqual(validateSnapshot(result), result);
});

test('a disabled reverse reuses its ID and history without restoring stale deck assignments', () => {
  const data = singleDirection();
  data.cards.push({ id: 'old-reverse', noteId: data.notes[0].id, direction: 'fr-ja', deckIds: ['b'], updatedAt: newestTime, deletedAt: newestTime });
  data.reviews.push({ id: 'old-answer', cardId: 'old-reverse', rating: 3, reviewedAt: originalTime });
  data.reviews.push({ id: 'old-undone', cardId: 'old-reverse', rating: 1, reviewedAt: laterTime });
  data.reviewUndos.push({ id: 'old-undo', reviewId: 'old-undone', undoneAt: newestTime });
  const previousSchedule = scheduleForCard(data, 'old-reverse');
  const result = validateSnapshot(data);
  assert.equal(result.cards.length, 2);
  assert.equal(direction(result, 'fr-ja').id, 'old-reverse');
  assert.deepEqual(direction(result, 'fr-ja').deckIds, ['a']);
  assert.equal(direction(result, 'fr-ja').updatedAt, originalTime);
  assert.deepEqual(scheduleForCard(result, 'old-reverse'), previousSchedule);
  assert.equal(scheduleForCard(result, 'old-reverse').reps, 1);
  assert.deepEqual(result.reviews, data.reviews);
  assert.deepEqual(result.reviewUndos, data.reviewUndos);
  assert.deepEqual(validateSnapshot(result), result);
});

test('multiple historical tombstones choose the latest disabled direction deterministically', () => {
  const data = singleDirection();
  data.cards.push(
    { id: 'older-reverse', noteId: data.notes[0].id, direction: 'fr-ja', deckIds: ['b'], updatedAt: originalTime, deletedAt: laterTime },
    { id: 'latest-reverse', noteId: data.notes[0].id, direction: 'fr-ja', deckIds: ['c'], updatedAt: laterTime, deletedAt: newestTime },
  );
  data.reviews.push({ id: 'older-history', cardId: 'older-reverse', rating: 3, reviewedAt: originalTime });
  const result = validateSnapshot(data);
  assert.equal(direction(result, 'fr-ja').id, 'latest-reverse');
  assert.deepEqual(result.cards.find((card) => card.id === 'older-reverse'), data.cards[1]);
  assert.deepEqual(result.reviews, data.reviews);
  assert.equal(scheduleForCard(result, 'older-reverse').reps, 1);
  const reordered = validateSnapshot({ ...data, cards: [...data.cards].reverse() });
  assert.equal(direction(reordered, 'fr-ja').id, 'latest-reverse');
  assert.deepEqual(validateSnapshot(result), result);
});

test('the latest active membership wins and subsequent removals apply to both directions', () => {
  const data = singleDirection();
  data.cards[0].deckIds = ['b'];
  data.cards[0].updatedAt = laterTime;
  data.cards.push({ id: 'reverse', noteId: data.notes[0].id, direction: 'fr-ja', deckIds: ['a', 'c'], updatedAt: originalTime });
  let result = validateSnapshot(data);
  for (const card of result.cards) assert.deepEqual(card.deckIds, ['b']);
  direction(result, 'fr-ja').deckIds = [];
  direction(result, 'fr-ja').updatedAt = newestTime;
  result = validateSnapshot(result);
  for (const card of result.cards) assert.deepEqual(card.deckIds, []);
  assert.deepEqual(validateSnapshot(result), result);
});

test('only membership timestamp ties union decks, using UTC instants and deterministic order', () => {
  const data = singleDirection();
  data.cards[0].deckIds = ['c', 'a'];
  data.cards[0].updatedAt = laterTime;
  data.cards.push({ id: 'reverse', noteId: data.notes[0].id, direction: 'fr-ja', deckIds: ['b', 'a'], updatedAt: '2026-11-02T01:00:00.000+01:00' });
  const result = validateSnapshot(data);
  for (const card of result.cards) assert.deepEqual(card.deckIds, ['a', 'b', 'c']);
  const reordered = validateSnapshot({ ...data, cards: [...data.cards].reverse() });
  for (const card of reordered.cards) assert.deepEqual(card, result.cards.find((other) => other.id === card.id));
  assert.deepEqual(validateSnapshot(result), result);
  data.cards[1].updatedAt = '2026-11-02T00:30:00.000+01:00';
  for (const card of validateSnapshot(data).cards) assert.deepEqual(card.deckIds, ['a', 'c']);
});

test('when both directions were disabled their IDs and latest deck placement are retained', () => {
  const data = singleDirection();
  data.cards[0].deletedAt = laterTime;
  data.cards.push({ id: 'reverse', noteId: data.notes[0].id, direction: 'fr-ja', deckIds: ['b'], updatedAt: laterTime, deletedAt: newestTime });
  const result = validateSnapshot(data);
  assert.equal(result.cards.length, 2);
  assert.equal(direction(result, 'ja-fr').id, 'original-forward');
  assert.equal(direction(result, 'fr-ja').id, 'reverse');
  for (const card of result.cards) assert.deepEqual(card.deckIds, ['b']);
});

test('missing IDs stay bounded for maximum-length note IDs and preserve existing card IDs', () => {
  const data = singleDirection('n'.repeat(160));
  data.cards[0].id = 'f'.repeat(160);
  data.notes.push({ ...data.notes[0], id: 'n'.repeat(159) + 'x' });
  const result = validateSnapshot(data);
  assert.equal(direction(result, 'ja-fr').id, data.cards[0].id);
  assert.equal(result.cards.length, 4);
  assert.equal(new Set(result.cards.map((card) => card.id)).size, 4);
  for (const card of result.cards) assert.ok(card.id.length > 0 && card.id.length <= 160);
  assert.deepEqual(validateSnapshot(result), result);
  const reordered = validateSnapshot({ ...data, notes: [...data.notes].reverse() });
  for (const note of data.notes) {
    for (const value of ['ja-fr', 'fr-ja'] as const) assert.equal(direction(reordered, value, note.id).id, direction(result, value, note.id).id);
  }
});

test('unrelated ID collisions use a deterministic bounded fallback without overwriting history', () => {
  const data = singleDirection('n'.repeat(149));
  const occupiedId = direction(validateSnapshot(data), 'fr-ja').id;
  assert.equal(occupiedId.length, 160);
  data.notes.push({ ...data.notes[0], id: 'unrelated' });
  const unrelated: StudyCard = { id: occupiedId, noteId: 'unrelated', direction: 'ja-fr', deckIds: ['c'], updatedAt: originalTime };
  data.cards.push(unrelated);
  data.reviews.push({ id: 'unrelated-review', cardId: occupiedId, rating: 3, reviewedAt: originalTime });
  const result = validateSnapshot(data);
  const reverse = direction(result, 'fr-ja');
  assert.notEqual(reverse.id, occupiedId);
  assert.ok(reverse.id.length <= 160);
  assert.deepEqual(result.cards.find((card) => card.id === occupiedId), unrelated);
  assert.equal(scheduleForCard(result, occupiedId).reps, 1);
  assert.equal(scheduleForCard(result, reverse.id).reps, 0);
  assert.equal(direction(validateSnapshot({ ...data, notes: [...data.notes].reverse(), cards: [...data.cards].reverse() }), 'fr-ja', data.notes[0].id).id, reverse.id);
  assert.deepEqual(validateSnapshot(result), result);
});

test('malformed references and duplicate active directions are rejected before repair', () => {
  let data = singleDirection();
  const wouldBeReverse = direction(validateSnapshot(data), 'fr-ja').id;
  data.reviews.push({ id: 'invented-reference', cardId: wouldBeReverse, rating: 3, reviewedAt: originalTime });
  assert.throws(() => validateSnapshot(data), /missing card/);
  data = singleDirection();
  data.cards.push({ ...data.cards[0], id: 'duplicate-active' });
  assert.throws(() => validateSnapshot(data), /same review direction/);
  data = singleDirection();
  data.cards.push({ ...data.cards[0], id: 'bad-deleted', direction: 'fr-ja', deckIds: ['missing'], deletedAt: laterTime });
  assert.throws(() => validateSnapshot(data), /missing note or deck/);
  data = singleDirection();
  data.cards[0].deckIds = ['a', 'a'];
  assert.throws(() => validateSnapshot(data), /duplicate deck/);
});
