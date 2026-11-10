import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLibraryIndex } from '../lib/library-index';
import { cardsForDeck } from '../lib/engine';
import { deckAncestors, noteDecks } from '../lib/library-view';
import { seedSnapshot } from '../lib/seed';

test('index matches existing active note and membership helpers', () => {
  const data = seedSnapshot();
  const index = buildLibraryIndex(data);
  assert.deepEqual([...index.noteIds].sort(), [...new Set(cardsForDeck(data, null).map(card => card.noteId))].sort());
  for (const note of data.notes) {
    assert.deepEqual(index.memberships.get(note.id), noteDecks(data, note.id));
  }
  for (const deck of data.decks.filter(item => !item.deletedAt)) {
    assert.equal(index.paths.get(deck.id), deckAncestors(data, deck.id).map(item => item.name).join('/'));
  }
});

test('deduplicates multiple card directions and shared deck assignments', () => {
  const data = seedSnapshot();
  const noteId = data.notes[0].id;
  const source = data.cards.find(card => card.noteId === noteId)!;
  data.cards.push({ ...source, id: 'extra-direction', direction: source.direction === 'ja-fr' ? 'fr-ja' : 'ja-fr' });
  source.deckIds.push(...source.deckIds);
  const index = buildLibraryIndex(data);
  assert.equal(index.noteIds.has(noteId), true);
  assert.equal(new Set(index.memberships.get(noteId)?.map(deck => deck.id)).size, index.memberships.get(noteId)?.length);
  assert.deepEqual(index.memberships.get(noteId), noteDecks(data, noteId));
});

test('ignores deleted cards and notes, while retaining active unassigned cards', () => {
  const data = seedSnapshot();
  const assigned = data.cards[0];
  const activeUnassignedNote = data.notes[0];
  data.cards = data.cards.filter(card => card.noteId !== activeUnassignedNote.id);
  const unassigned = { ...assigned, id: 'unassigned-card', noteId: activeUnassignedNote.id, deckIds: [] };
  data.cards.push(unassigned);
  const deletedCard = { ...assigned, id: 'deleted-card', noteId: activeUnassignedNote.id, deletedAt: '2026-11-09T12:00:00.000Z' };
  data.cards.push(deletedCard);
  const deletedNote = data.notes[1];
  deletedNote.deletedAt = '2026-11-09T12:00:00.000Z';
  data.cards.push({ ...assigned, id: 'deleted-note-card', noteId: deletedNote.id });
  const index = buildLibraryIndex(data);
  assert.equal(index.noteIds.has(activeUnassignedNote.id), true);
  assert.equal(index.memberships.get(activeUnassignedNote.id)?.length, noteDecks(data, activeUnassignedNote.id).length);
  assert.equal(index.noteIds.has(deletedNote.id), false);
  assert.equal(index.memberships.get(deletedNote.id)?.length ?? 0, 0);
});

test('membership ignores deleted decks and paths skip deleted ancestors', () => {
  const data = seedSnapshot();
  const noteId = data.notes[0].id;
  const card = data.cards.find(item => item.noteId === noteId)!;
  const deletedDeck = data.decks[0];
  card.deckIds.push(deletedDeck.id);
  deletedDeck.deletedAt = '2026-11-09T12:00:00.000Z';
  const descendant = data.decks.find(deck => deck.parentId === deletedDeck.id);
  const index = buildLibraryIndex(data);
  assert.deepEqual(index.memberships.get(noteId), noteDecks(data, noteId));
  if (descendant && !descendant.deletedAt) {
    assert.equal(index.paths.get(descendant.id), deckAncestors(data, descendant.id).map(deck => deck.name).join('/'));
  }
});

test('paths handle missing parents and cycles without mutating the snapshot', () => {
  const data = seedSnapshot();
  data.decks[0].parentId = data.decks[1].id;
  data.decks[1].parentId = data.decks[0].id;
  const before = data.decks.map(deck => deck.parentId);
  const index = buildLibraryIndex(data);
  assert.deepEqual(data.decks.map(deck => deck.parentId), before);
  for (const deck of data.decks.filter(item => !item.deletedAt)) assert.equal(typeof index.paths.get(deck.id), 'string');
  data.decks[0].parentId = 'missing-parent';
  const missing = buildLibraryIndex(data);
  assert.equal(typeof missing.paths.get(data.decks[0].id), 'string');
});
