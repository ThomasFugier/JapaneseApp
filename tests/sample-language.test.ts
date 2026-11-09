import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnmodifiedSample, seedSnapshot } from '../lib/seed';
import { validateSnapshot } from '../lib/model';
import { scheduleForCard } from '../lib/engine';
import { backupBytes, readBackup } from '../lib/portability';
import legacy from '../lib/legacy-sample-content.json';

function frenchSamples() {
  const data = seedSnapshot();
  for (const note of data.notes) Object.assign(note, structuredClone(legacy.notes.find(item => item.id === note.id)));
  for (const deck of data.decks) Object.assign(deck, structuredClone(legacy.decks.find(item => item.id === deck.id)));
  return data;
}

test('sample translations, example sentences and categories are English', () => {
  const data = seedSnapshot();
  const apple = data.notes.find(note => note.id === 'note-ringo')!;
  assert.equal(apple.meaning, 'apple');
  assert.equal(apple.exampleTranslation, 'I eat an apple.');
  assert.equal(data.notes.find(note => note.id === 'note-taberu')!.meaning, 'to eat');
  assert.deepEqual(data.decks.map(deck => deck.name), ['Japanese', 'Vocabulary', 'Verbs', 'Work & study', 'Everyday life', 'Food & drink', 'Grammar', 'Kanji']);
  assert.ok(data.notes.every(note => !note.tags.some(tag => ['verbe', 'nom', 'adjectif', 'temps', 'particule', 'structure'].includes(tag))));
  assert.equal(data.notes.find(note => note.id === 'note-particle-wa')!.reading, 'わ');
});

test('stored French samples migrate without changing identities, memberships or review statistics', () => {
  const before = frenchSamples();
  before.reviews.push({ id: 'past-review', cardId: 'card-taberu', rating: 3, reviewedAt: '2026-11-08T10:00:00.000Z' });
  const original = structuredClone(before);
  const result = validateSnapshot(before);
  const english = seedSnapshot();
  for (const note of result.notes) {
    const expected = english.notes.find(item => item.id === note.id)!;
    for (const field of ['japanese', 'reading', 'meaning', 'example', 'exampleTranslation', 'explanation', 'tags'] as const) assert.deepEqual(note[field], expected[field]);
  }
  assert.deepEqual(result.decks.map(deck => [deck.id, deck.name, deck.parentId]), english.decks.map(deck => [deck.id, deck.name, deck.parentId]));
  assert.deepEqual(result.cards, before.cards);
  assert.deepEqual(result.reviews, before.reviews);
  assert.deepEqual(scheduleForCard(result, 'card-taberu'), scheduleForCard(before, 'card-taberu'));
  assert.deepEqual(before, original);
  assert.deepEqual(validateSnapshot(result), result);
});

test('translation preserves customized values, tags and deck descriptions', () => {
  const data = frenchSamples();
  data.notes[0].meaning = 'My own definition';
  data.notes[0].explanation = 'My grammar note';
  data.notes[0].tags.push('personal');
  data.decks[0].name = 'My Japanese';
  data.decks[0].description = 'My course';
  const result = validateSnapshot(data);
  assert.equal(result.notes[0].meaning, 'My own definition');
  assert.equal(result.notes[0].explanation, 'My grammar note');
  assert.deepEqual(result.notes[0].tags, ['verb', 'JLPT N5', 'personal']);
  assert.equal(result.notes[0].exampleTranslation, 'I eat bread every morning.');
  assert.equal(result.decks[0].name, 'My Japanese');
  assert.equal(result.decks[0].description, 'My course');
});

test('unrelated and archived notes are not mistaken for sample content', () => {
  const data = frenchSamples();
  data.notes[0].id = 'personal-note';
  for (const card of data.cards) if (card.noteId === 'note-taberu') card.noteId = 'personal-note';
  data.notes[1].deletedAt = '2026-11-08T10:00:00.000Z';
  const result = validateSnapshot(data);
  assert.equal(result.notes[0].meaning, 'Manger');
  assert.equal(result.notes[1].meaning, 'Pomme');
});

test('legacy backups are translated on import and retain review history', () => {
  const data = frenchSamples();
  data.reviews.push({ id: 'review-to-keep', cardId: 'card-taberu', rating: 2, reviewedAt: '2026-11-08T10:00:00.000Z' });
  const result = readBackup(backupBytes(data));
  assert.equal(result.notes[0].meaning, 'to eat');
  assert.equal(result.decks[1].name, 'Vocabulary');
  assert.deepEqual(result.reviews, data.reviews);
});

test('translated examples stay recognizable at GitHub connection, while edits and progress remain personal', () => {
  const data = validateSnapshot(frenchSamples());
  assert.equal(isUnmodifiedSample(data), true);
  data.notes[0].meaning = 'My definition';
  assert.equal(isUnmodifiedSample(data), false);
  const reviewed = validateSnapshot(frenchSamples());
  reviewed.reviews.push({ id: 'personal-progress', cardId: 'card-taberu', rating: 3, reviewedAt: '2026-11-08T10:00:00.000Z' });
  assert.equal(isUnmodifiedSample(reviewed), false);
});
