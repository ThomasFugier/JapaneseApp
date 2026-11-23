import assert from 'node:assert/strict';
import test from 'node:test';
import { addStoryFlashcard, type StoryFlashcardDraft } from '../lib/story-flashcards';
import { emptySnapshot, validateSnapshot, type Snapshot } from '../lib/model';
import { backupBytes, readBackup } from '../lib/portability';
import { mergeSnapshots } from '../lib/merge';
import { cardsForDeck } from '../lib/engine';

const first = '2026-11-23T10:00:00.000Z', later = '2026-11-23T10:01:00.000Z';
const draft: StoryFlashcardDraft = {
  word: { text: '猫', reading: 'ねこ', meaning: 'Un chat.' }, example: '小さな猫がいました。',
  story: { subtitle: 'Un petit ami', title: '小さな友達', level: 'N5' },
};
function withDecks(): Snapshot {
  return validateSnapshot({ ...emptySnapshot(), decks: [
    { id: 'deck-a', name: 'Vocabulaire', description: '', parentId: null, color: 'sage', updatedAt: first },
    { id: 'deck-b', name: 'Histoires', description: '', parentId: null, color: 'sky', updatedAt: first },
  ] });
}

test('one story word creates a note and both review directions with its source and example', () => {
  const snapshot = addStoryFlashcard(withDecks(), draft, 'deck-a', first, 'story-note');
  assert.equal(snapshot.notes.length, 1);
  assert.deepEqual(snapshot.notes[0], {
    id: 'story-note', japanese: '猫', reading: 'ねこ', meaning: 'Un chat.', example: draft.example,
    exampleTranslation: '', explanation: 'Histoire : Un petit ami (小さな友達) · N5',
    tags: ['Histoires', 'N5'], createdAt: first, updatedAt: first,
  });
  assert.deepEqual(snapshot.cards.map(card => [card.direction, card.deckIds]), [['ja-fr', ['deck-a']], ['fr-ja', ['deck-a']]]);
  assert.equal(cardsForDeck(snapshot, 'deck-a').length, 2);
  assert.deepEqual(snapshot.reviews, []);
});

test('a word can be saved without any deck and remains available in All cards', () => {
  const snapshot = addStoryFlashcard(emptySnapshot(), draft, null, first, 'story-note');
  assert.equal(cardsForDeck(snapshot, null).length, 2);
  assert.ok(snapshot.cards.every(card => card.deckIds.length === 0));
});

test('repeated clicks reuse the existing note without changing its edits or review history', () => {
  const base = addStoryFlashcard(withDecks(), draft, 'deck-a', first, 'story-note');
  base.notes[0].example = 'Mon exemple personnel';
  base.reviews.push({ id: 'review', cardId: base.cards[0].id, rating: 3, reviewedAt: first });
  const duplicate = addStoryFlashcard(base, draft, 'deck-a', later, 'unused-id');
  assert.equal(duplicate, base);
  assert.equal(duplicate.notes.length, 1);
  assert.equal(duplicate.cards.length, 2);
  assert.equal(duplicate.reviews.length, 1);
  assert.equal(duplicate.notes[0].example, 'Mon exemple personnel');
});

test('an existing word can join another deck without losing its cards or learning history', () => {
  const base = addStoryFlashcard(withDecks(), draft, 'deck-a', first, 'story-note');
  base.reviews.push({ id: 'review', cardId: base.cards[0].id, rating: 3, reviewedAt: first });
  const saved = addStoryFlashcard(base, draft, 'deck-b', later, 'unused-id');
  assert.deepEqual(saved.notes, base.notes);
  assert.deepEqual(saved.reviews, base.reviews);
  assert.deepEqual(saved.cards.map(card => card.id), base.cards.map(card => card.id));
  assert.ok(saved.cards.every(card => card.deckIds.includes('deck-a') && card.deckIds.includes('deck-b')));
  assert.ok(base.cards.every(card => !card.deckIds.includes('deck-b')));
});

test('a different contextual meaning remains a separate sense', () => {
  const base = addStoryFlashcard(emptySnapshot(), draft, null, first, 'sense-a');
  const second = addStoryFlashcard(base, { ...draft, word: { ...draft.word, meaning: 'Un chat (animal de compagnie).' } }, null, later, 'sense-b');
  assert.equal(second.notes.length, 2);
  assert.equal(second.cards.length, 4);
});

test('missing or deleted decks and invalid words never modify the library', () => {
  const base = withDecks(), before = structuredClone(base);
  assert.throws(() => addStoryFlashcard(base, draft, 'missing', first, 'new-note'), /deck/);
  base.decks[0].deletedAt = later;
  assert.throws(() => addStoryFlashcard(base, draft, 'deck-a', later, 'new-note'), /deck/);
  assert.deepEqual(base.notes, []);
  assert.deepEqual(base.cards, []);
  assert.deepEqual(before, withDecks());
  assert.throws(() => addStoryFlashcard(base, { ...draft, word: { ...draft.word, text: ' ' } }, null, later, 'new-note'));
  assert.deepEqual(base.notes, []);
});

test('saved story flashcards survive backup and merge with independent library changes', () => {
  const base = withDecks();
  const local = addStoryFlashcard(base, draft, 'deck-a', first, 'local-note');
  const remote = addStoryFlashcard(base, { ...draft, word: { text: '雨', reading: 'あめ', meaning: 'La pluie.' } }, 'deck-b', later, 'remote-note');
  const merged = mergeSnapshots(base, local, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.snapshot.notes.length, 2);
  assert.equal(merged.snapshot.cards.length, 4);
  assert.deepEqual(readBackup(backupBytes(merged.snapshot)), merged.snapshot);
});
