import assert from 'node:assert/strict';
import test from 'node:test';
import { storyFlashcardValues, type StoryFlashcardDraft } from '../lib/story-flashcards';
import { emptySnapshot, type Note } from '../lib/model';
import { findDuplicateNote, similarNotes } from '../lib/note-similarity';

const draft: StoryFlashcardDraft = {
  word: { text: '猫', reading: 'ねこ', meaning: 'Un chat.' }, example: '小さな猫がいました。',
  story: { subtitle: 'Un petit ami', title: '小さな友達', level: 'N5' },
};
const saved: Note = {
  id: 'manual-note', japanese: '猫', reading: 'ねこ', meaning: 'Un chat.', example: 'Mon exemple personnel',
  exampleTranslation: '', explanation: '', tags: ['Personnel'], updatedAt: '2026-11-23T10:00:00.000Z',
};
const library = () => ({ ...emptySnapshot(), notes: [structuredClone(saved)], cards: [
  { id: 'manual-note:ja-fr', noteId: saved.id, direction: 'ja-fr' as const, deckIds: [], updatedAt: saved.updatedAt },
] });

test('a prefilled story word uses the manual editor duplicate recognition without modifying the saved card', () => {
  const snapshot = library(), before = structuredClone(snapshot);
  const values = storyFlashcardValues(draft);
  assert.equal(findDuplicateNote(snapshot, values)?.id, saved.id);
  assert.equal(similarNotes(snapshot, values)[0].duplicate, true);
  assert.equal(values.example, draft.example);
  assert.match(values.explanation, /Un petit ami/);
  assert.deepEqual(snapshot, before);
  assert.ok(!('id' in values));
});

test('a different story translation still exposes the existing word as a similar card', () => {
  const snapshot = library();
  const values = storyFlashcardValues({ ...draft, word: { ...draft.word, meaning: 'Un petit chat.' } });
  assert.equal(findDuplicateNote(snapshot, values), undefined);
  const matches = similarNotes(snapshot, values);
  assert.equal(matches[0].note.id, saved.id);
  assert.equal(matches[0].sameWord, true);
  assert.equal(matches[0].duplicate, false);
});
