import test from 'node:test';
import assert from 'node:assert/strict';
import { bulkLibraryAction, moveLibraryDeck } from '../lib/library-actions';
import { validateSnapshot } from '../lib/model';
import { seedSnapshot } from '../lib/seed';
import { scheduleForCard } from '../lib/engine';

const now = '2026-11-10T12:00:00.000Z';

test('bulk deck changes update both directions once and preserve review history and input', () => {
  const data = seedSnapshot(), note = data.notes[0];
  const noteCards = data.cards.filter(card => card.noteId === note.id);
  data.reviews = [
    { id: 'forward-review', cardId: noteCards.find(card => card.direction === 'ja-fr')!.id, rating: 3, reviewedAt: now },
    { id: 'reverse-review', cardId: noteCards.find(card => card.direction === 'fr-ja')!.id, rating: 4, reviewedAt: now },
    { id: 'undone-review', cardId: noteCards.find(card => card.direction === 'fr-ja')!.id, rating: 1, reviewedAt: now },
  ];
  data.reviewUndos.push({ id: 'undo-review', reviewId: 'undone-review', undoneAt: now });
  const before = structuredClone(data);
  const schedules = new Map(noteCards.map(card => [card.id, scheduleForCard(data, card.id)]));
  const added = bulkLibraryAction(data, [note.id, note.id], { type: 'add-deck', deckId: 'cuisine' }, now);
  const selected = added.cards.filter(card => card.noteId === note.id && !card.deletedAt);
  assert.equal(selected.length, 2);
  for (const card of selected) assert.equal(card.deckIds.filter(id => id === 'cuisine').length, 1);
  assert.deepEqual(added.reviews, data.reviews);
  assert.deepEqual(added.reviewUndos, data.reviewUndos);
  assert.deepEqual(added.cards.map(({ id, direction }) => ({ id, direction })), data.cards.map(({ id, direction }) => ({ id, direction })));
  for (const card of noteCards) assert.deepEqual(scheduleForCard(added, card.id), schedules.get(card.id));
  assert.deepEqual(data, before);
  const removed = bulkLibraryAction(added, [note.id], { type: 'remove-deck', deckId: 'cuisine' }, now);
  for (const card of removed.cards.filter(card => card.noteId === note.id && !card.deletedAt)) assert(!card.deckIds.includes('cuisine'));
  for (const card of noteCards) assert.deepEqual(scheduleForCard(removed, card.id), schedules.get(card.id));
});

test('bulk tags use normalized duplicate handling, preserve other notes, and avoid needless timestamps', () => {
  const data = seedSnapshot(), note = data.notes[0];
  note.tags = ['café'];
  const unchanged = bulkLibraryAction(data, [note.id], { type: 'add-tags', tags: ['CAFÉ', ' Café  '] }, now);
  assert.deepEqual(unchanged.notes.find(item => item.id === note.id)!.tags, ['café']);
  assert.equal(unchanged.notes.find(item => item.id === note.id)!.updatedAt, note.updatedAt);
  const changed = bulkLibraryAction(data, [note.id], { type: 'add-tags', tags: ['  daily   life ', 'NOUN'] }, now);
  assert.deepEqual(changed.notes.find(item => item.id === note.id)!.tags, ['café', 'daily life', 'noun']);
  assert.equal(changed.notes.find(item => item.id === note.id)!.updatedAt, now);
});

test('tag limit failure leaves every selected note untouched', () => {
  const data = seedSnapshot(), first = data.notes[0], second = data.notes[1];
  first.tags = ['existing'];
  second.tags = Array.from({ length: 30 }, (_, index) => `tag-${index}`);
  const before = structuredClone(data);
  assert.throws(() => bulkLibraryAction(data, [first.id, second.id], { type: 'add-tags', tags: ['new-tag'] }, now), /30 tags/);
  assert.deepEqual(data, before);
});

test('adding an already assigned deck is a timestamp-preserving no-op', () => {
  const data = seedSnapshot(), note = data.notes[0], card = data.cards.find(item => item.noteId === note.id && !item.deletedAt)!;
  const previous = card.updatedAt;
  const result = bulkLibraryAction(data, [note.id], { type: 'add-deck', deckId: card.deckIds[0] }, now);
  assert.equal(result.cards.find(item => item.id === card.id)!.updatedAt, previous);
});

test('bulk delete tombstones selected note and both active directions without erasing records', () => {
  const data = seedSnapshot(), note = data.notes[0];
  const originalCards = data.cards.filter(card => card.noteId === note.id);
  data.reviews.push({ id: 'retained-review', cardId: originalCards[0].id, rating: 3, reviewedAt: now });
  data.reviewUndos.push({ id: 'retained-undo', reviewId: 'retained-review', undoneAt: now });
  const result = bulkLibraryAction(data, [note.id], { type: 'delete' }, now);
  assert.equal(result.notes.find(item => item.id === note.id)!.deletedAt, now);
  assert.deepEqual(result.cards.filter(card => card.noteId === note.id).map(card => card.deletedAt), originalCards.map(() => now));
  assert.deepEqual(result.reviews, data.reviews);
  assert.deepEqual(result.reviewUndos, data.reviewUndos);
});

test('invalid selections and deck assignments fail atomically, including deleted targets', () => {
  const data = seedSnapshot(), before = structuredClone(data);
  assert.throws(() => bulkLibraryAction(data, [data.notes[0].id, 'missing'], { type: 'delete' }, now), /no longer available/);
  data.decks.find(deck => deck.id === 'cuisine')!.deletedAt = now;
  const invalidBefore = structuredClone(data);
  assert.throws(() => bulkLibraryAction(data, [data.notes[0].id], { type: 'add-deck', deckId: 'cuisine' }, now), /no longer available/);
  assert.deepEqual(data, invalidBefore);
  assert.deepEqual(before.notes[0], data.notes[0]);
});

test('moving a deck reparents only that deck and rejects self, descendant, or deleted targets', () => {
  const data = seedSnapshot();
  const first = data.decks[0], second = data.decks[1];
  second.parentId = null;
  const before = structuredClone(data);
  const moved = moveLibraryDeck(data, second.id, first.id, now);
  assert.equal(moved.decks.find(deck => deck.id === second.id)!.parentId, first.id);
  assert.equal(moved.decks.find(deck => deck.id === second.id)!.updatedAt, now);
  assert.deepEqual(moved.decks.filter(deck => deck.id !== second.id), data.decks.filter(deck => deck.id !== second.id));
  assert.deepEqual(data, before);
  assert.throws(() => moveLibraryDeck(moved, first.id, second.id, now), /descendant/);
  assert.throws(() => moveLibraryDeck(data, first.id, first.id, now), /itself/);
  assert.throws(() => moveLibraryDeck(data, first.id, 'deleted-deck', now), /no longer available/);
});

test('moving through a tombstoned ancestor cannot create a hidden cycle', () => {
  const data = seedSnapshot();
  const root = data.decks.find(deck => deck.id === 'japonais')!;
  data.decks.push(
    { ...root, id: 'tombstoned-ancestor', parentId: root.id, deletedAt: now },
    { ...root, id: 'visible-descendant', parentId: 'tombstoned-ancestor' },
  );
  validateSnapshot(data);
  assert.throws(() => moveLibraryDeck(data, root.id, 'visible-descendant', now), /descendant/);
  assert.equal(data.decks.find(deck => deck.id === root.id)!.parentId, null);
});
