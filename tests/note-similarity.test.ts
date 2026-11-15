import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySnapshot, type Note, type Snapshot } from '../lib/model';
import { findDuplicateNote, similarNotes } from '../lib/note-similarity';

const date = '2026-11-15T10:00:00.000Z';
const note = (id: string, japanese = '林檎', reading = 'りんご', meaning = 'apple'): Note => ({ id, japanese, reading, meaning, example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: date });
function collection(notes: Note[]): Snapshot {
  return { ...emptySnapshot(), notes, cards: notes.flatMap(item => (['ja-fr', 'fr-ja'] as const).map(direction => ({ id: `${item.id}:${direction}`, noteId: item.id, direction, deckIds: ['another-deck'], updatedAt: date }))) };
}
const draft = (japanese: string, reading = '', meaning = '') => ({ japanese, reading, meaning });

test('partial and approximate creation input finds saved romaji and kana readings', () => {
  const data = collection([note('apple'), note('eat', '食べる', 'たべる', 'eat')]);
  for (const query of ['Ring', 'ringa', 'rigno', 'ringo', 'りんご', 'リンゴ', 'ﾘﾝｺﾞ']) {
    assert.deepEqual(similarNotes(data, draft(query)).map(match => match.note.id), ['apple'], query);
  }
  assert.deepEqual(similarNotes(data, draft('', 'ringa')).map(match => match.note.id), ['apple']);
  assert.deepEqual(similarNotes(data, draft('', '', 'appl')).map(match => match.note.id), ['apple']);
});

test('matches span decks, deduplicate review directions, and ignore removed cards', () => {
  const data = collection([note('active'), { ...note('deleted'), deletedAt: date }, note('no-cards'), note('removed-cards')]);
  data.cards = data.cards.filter(card => card.noteId !== 'no-cards').map(card => card.noteId === 'removed-cards' ? { ...card, deletedAt: date } : card);
  assert.deepEqual(similarNotes(data, draft('Ring')).map(match => match.note.id), ['active']);
});

test('exact duplicates sort first and a bounded list never mutates the library', () => {
  const data = collection([note('near', '林檎', 'りんご', 'apple pie'), note('exact'), ...Array.from({ length: 12 }, (_, index) => note(`other-${index}`, '林檎飴', 'りんごあめ', 'candied apple'))]);
  const before = JSON.stringify(data);
  const matches = similarNotes(data, draft('RINGO', '', 'Apple'));
  assert.equal(matches.length, 5);
  assert.equal(matches[0].note.id, 'exact');
  assert.equal(matches[0].duplicate, true);
  assert.equal(matches.find(match => match.note.id === 'near')?.duplicate, false);
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(similarNotes(data, draft('ringo'), 0), []);
});

test('only the same word and meaning block creation, preserving homophones and different senses', () => {
  const data = collection([note('apple'), note('bridge', '橋', 'はし', 'bridge')]);
  for (const query of ['ringo', 'りんご', 'リンゴ', '林檎']) assert.equal(findDuplicateNote(data, draft(query, '', ' APPLE '))?.id, 'apple');
  assert.equal(findDuplicateNote(data, draft('ringa', '', 'apple')), undefined);
  assert.equal(findDuplicateNote(data, draft('林檎', '', 'apple pie')), undefined);
  assert.equal(findDuplicateNote(data, draft('箸', 'はし', 'chopsticks')), undefined);
  assert.equal(findDuplicateNote(data, draft('橋', 'きょう', 'bridge')), undefined);
  assert.equal(findDuplicateNote(data, draft('林檎')), undefined);
});

test('a save-time check sees a duplicate added after suggestions were calculated', () => {
  const current = emptySnapshot();
  const input = draft('ringo', '', 'apple');
  assert.equal(findDuplicateNote(current, input), undefined);
  const latest = collection([note('synced-apple')]);
  assert.equal(findDuplicateNote(latest, input)?.id, 'synced-apple');
});

test('empty input and one Latin letter do not flood the suggestion list', () => {
  const data = collection([note('apple'), note('tree', '木', 'き', 'tree')]);
  assert.deepEqual(similarNotes(data, draft('')), []);
  assert.deepEqual(similarNotes(data, draft('r')), []);
  assert.equal(similarNotes(data, draft('木'))[0]?.note.id, 'tree');
});
