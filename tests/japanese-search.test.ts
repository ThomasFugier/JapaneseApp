import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesNote, noteSearchRank, writingSuggestions } from '../lib/japanese-search';
import { emptySnapshot, type Note, type Snapshot } from '../lib/model';
import { libraryNotes, defaultReadingContext } from '../lib/library-view';

const date = '2026-11-09T10:00:00.000Z';
function note(id: string, japanese: string, reading: string, meaning: string): Note {
  return { id, japanese, reading, meaning, example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: date };
}
function collection(notes: Note[]): Snapshot {
  const data = emptySnapshot();
  data.notes = notes;
  data.cards = notes.map(item => ({ id: `card-${item.id}`, noteId: item.id, direction: 'ja-fr', deckIds: [], updatedAt: date }));
  return data;
}

test('romaji and partial input match saved kana and katakana readings', () => {
  const apple = note('apple', '林檎', 'りんご', 'Pomme');
  for (const query of ['ringo', 'RINGO', 'ri', 'rin', 'ring', 'りんご', 'リンゴ', 'ﾘﾝｺﾞ', 'pomme']) assert.ok(matchesNote(apple, query), query);
  apple.reading = 'リンゴ';
  assert.ok(matchesNote(apple, 'ringo'));
  assert.ok(matchesNote(apple, 'りんご'));
  const voiced = note('voiced', '鍵', 'かぎ', 'Clé');
  assert.ok(matchesNote(voiced, 'kagi'));
  assert.ok(noteSearchRank(voiced, 'kagi') < noteSearchRank(voiced, 'kaki'));
});

test('romaji spelling variants and on/kun okurigana readings share the matcher', () => {
  const city = note('city', '市', 'し', 'Ville');
  assert.ok(matchesNote(city, 'shi'));
  assert.ok(matchesNote(city, 'si'));
  const eat = { ...note('eat', '食', '', 'Manger'), onReadings: ['ショク', 'ジキ'], kunReadings: ['た.べる', 'く.う'] };
  for (const query of ['shoku', 'syoku', 'ショク', 'しょく', 'jiki', 'taberu', 'tabe', 'たべる', 'kuu']) assert.ok(matchesNote(eat, query), query);
  assert.ok(writingSuggestions(collection([eat]), 'tabe').some(item => item.id === 'eat'));
});

test('library keeps French, tags and explanations search while missing readings are not guessed', () => {
  const apple = note('apple', '林檎', '', 'Pomme');
  assert.equal(matchesNote(apple, 'ringo'), false);
  apple.explanation = 'Un fruit récolté en automne.';
  apple.tags = ['aliment'];
  assert.ok(matchesNote(apple, 'RECOLTE'));
  assert.ok(matchesNote(apple, 'aliment'));
  assert.equal(writingSuggestions(collection([apple]), 'récolté').length, 0);
  assert.equal(writingSuggestions(collection([apple]), 'aliment').length, 0);
  apple.reading = 'りんご';
  assert.equal(libraryNotes(collection([apple]), { ...defaultReadingContext, search: 'ring' })[0]?.id, 'apple');
});

test('Writing ranks exact saved terms before prefixes and substrings, with stable ties', () => {
  const data = collection([
    note('substring', '青林檎', 'あおりんご', 'Pomme verte'),
    note('prefix', '林檎飴', 'りんごあめ', 'Pomme d’amour'),
    note('exact-b', '林檎', 'りんご', 'Pomme'),
    note('exact-a', '林檎', 'りんご', 'Pomme'),
  ]);
  assert.deepEqual(writingSuggestions(data, 'ringo').map(item => item.id), ['exact-a', 'exact-b', 'prefix', 'substring']);
  assert.equal(writingSuggestions(data, 'ringo', 1)[0]?.id, 'exact-a');
  assert.equal(writingSuggestions(data, 'pomme')[0]?.id, 'exact-a');
  assert.deepEqual(writingSuggestions(data, ''), []);
  assert.deepEqual(writingSuggestions(data, 'ringo', 0), []);
});

test('Writing excludes deleted and unlinked entries and deduplicates reverse cards', () => {
  const data = collection([
    note('active', '林檎', 'りんご', 'Pomme'),
    { ...note('deleted-note', '林檎', 'りんご', 'Pomme'), deletedAt: date },
    note('deleted-card', '林檎', 'りんご', 'Pomme'),
    note('unlinked', '林檎', 'りんご', 'Pomme'),
  ]);
  data.cards = data.cards.filter(card => card.noteId !== 'unlinked').map(card => card.noteId === 'deleted-card' ? { ...card, deletedAt: date } : card);
  data.cards.push({ ...data.cards[0], id: 'reverse', direction: 'fr-ja' });
  assert.deepEqual(writingSuggestions(data, 'ringo').map(item => item.id), ['active']);
});

test('typos in saved readings match substitutions, missing/extra letters and swaps', () => {
  const apple = note('apple', '林檎', 'リンゴ', 'Pomme');
  const data = collection([apple, note('eat', '食べる', 'たべる', 'Manger')]);
  for (const query of ['rango', 'RANGO', 'rngo', 'ringgo', 'rigno', 'らんご', 'ランゴ']) {
    assert.deepEqual(libraryNotes(data, { ...defaultReadingContext, search: query }).map(item => item.id), ['apple'], query);
    assert.deepEqual(writingSuggestions(data, query).map(item => item.id), ['apple'], query);
  }
  assert.ok(matchesNote(apple, 'pome'));
});

test('exact and partial matches precede typos, with the selected sort breaking ties', () => {
  const data = collection([
    note('near', '林檎', 'りんご', 'Pomme'),
    note('exact', 'ランゴ', 'らんご', 'Exact'),
    note('prefix', 'ランゴー', 'らんごー', 'Préfixe'),
    note('substring', 'アランゴ', 'あらんご', 'Contient'),
  ]);
  const expected = ['exact', 'prefix', 'substring', 'near'];
  for (const sort of ['japanese', 'meaning', 'added'] as const) {
    assert.deepEqual(libraryNotes(data, { ...defaultReadingContext, search: 'rango', sort }).map(item => item.id), expected);
  }
  assert.deepEqual(writingSuggestions(data, 'rango').map(item => item.id), expected);
});

test('fuzzy matching includes on/kun readings and allows two typos only in longer words', () => {
  const eat = { ...note('eat', '食', '', 'Manger'), onReadings: ['ショク'], kunReadings: ['た.べる'] };
  assert.ok(matchesNote(eat, 'shuku'));
  assert.ok(matchesNote(eat, 'tabru'));
  const food = note('food', '食べ物', 'たべもの', 'Nourriture');
  assert.ok(matchesNote(food, 'tobemona'));
  assert.equal(matchesNote(food, 'takemane'), false);
  const apple = note('apple', '林檎', 'りんご', 'Pomme');
  for (const query of ['xyz', 'rano', 'zzzzz', '林語', 'x'.repeat(1000)]) assert.equal(matchesNote(apple, query), false, query);
  assert.ok(matchesNote(apple, 'ri'));
});

test('fuzzy results respect deck scope, deletion and one entry per note', () => {
  const data = collection([
    note('active', '林檎', 'りんご', 'Pomme'),
    { ...note('deleted', '林檎', 'りんご', 'Pomme'), deletedAt: date },
    note('elsewhere', '林檎', 'りんご', 'Pomme'),
    note('unlinked', '林檎', 'りんご', 'Pomme'),
  ]);
  data.decks = ['cuisine', 'other'].map(id => ({ id, name: id, description: '', parentId: null, color: 'rose', updatedAt: date }));
  data.cards = data.cards.filter(card => card.noteId !== 'unlinked')
    .map(card => ({ ...card, deckIds: [card.noteId === 'elsewhere' ? 'other' : 'cuisine'] }));
  data.cards.push({ ...data.cards[0], id: 'reverse', direction: 'fr-ja' });
  assert.deepEqual(libraryNotes(data, { ...defaultReadingContext, deckId: 'cuisine', search: 'rango' }).map(item => item.id), ['active']);
  assert.deepEqual(writingSuggestions(data, 'rango').map(item => item.id), ['active', 'elsewhere']);
});
