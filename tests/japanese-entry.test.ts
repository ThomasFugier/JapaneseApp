import assert from 'node:assert/strict';
import test from 'node:test';
import { changeJapaneseEntry, commitJapaneseEntry, createJapaneseEntry, insertJapaneseEntry, matchJapaneseEntry, type JapaneseEntry } from '../lib/japanese-entry';
import { emptySnapshot } from '../lib/model';

const data = emptySnapshot();
for (const [id, japanese, reading] of [['apple', '林檎', 'りんご'], ['rain', '雨', 'あめ']]) {
  data.notes.push({ id, japanese, reading, meaning: id, example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: '2026-11-15T10:00:00Z' });
  data.cards.push({ id, noteId: id, direction: 'ja-fr', deckIds: [], updatedAt: '2026-11-15T10:00:00Z' });
}
function type(entry: JapaneseEntry, text: string, mode: 'hiragana' | 'katakana' = 'hiragana') {
  for (const character of text) {
    const { start, end } = entry.selection;
    const raw = entry.text.slice(0, start) + character + entry.text.slice(end);
    entry = changeJapaneseEntry(entry, raw, { start: start + character.length, end: start + character.length }, mode);
  }
  return entry;
}

test('Escape-style commit isolates adjacent typing without requiring spaces', () => {
  let entry = type(createJapaneseEntry(), 'ringo');
  assert.equal(entry.text, 'りんご');
  assert.deepEqual(entry.pending, { start: 0, end: 3 });
  assert.equal(matchJapaneseEntry(data, entry)?.range.query, 'りんご');
  entry = commitJapaneseEntry(entry);
  assert.equal(entry.pending, null);
  assert.equal(matchJapaneseEntry(data, entry), null);
  entry = type(entry, 'ame');
  assert.equal(entry.text, 'りんごあめ');
  assert.deepEqual(entry.pending, { start: 3, end: 5 });
  const match = matchJapaneseEntry(data, entry)!;
  assert.equal(match.range.query, 'あめ');
  entry = insertJapaneseEntry(entry, match, data.notes[1]);
  assert.equal(entry.text, 'りんご雨');
  assert.equal(entry.pending, null);
});

test('accepting a suggestion commits it and the following word is an independent entry', () => {
  let entry = type(createJapaneseEntry('🍎 '), 'ringo');
  entry = insertJapaneseEntry(entry, matchJapaneseEntry(data, entry)!, data.notes[0]);
  assert.equal(entry.text, '🍎 林檎');
  assert.deepEqual(entry.selection, { start: 5, end: 5 });
  entry = type(entry, 'ame');
  assert.equal(matchJapaneseEntry(data, entry)?.range.query, 'あめ');
  assert.deepEqual(entry.pending, { start: 5, end: 7 });
  assert.equal(insertJapaneseEntry(entry, matchJapaneseEntry(data, entry)!, data.notes[1]).text, '🍎 林檎雨');
});

test('commit works without suggestions and finalizes pending n before fresh romaji', () => {
  let entry = type(createJapaneseEntry(), 'kan');
  assert.equal(entry.text, 'かn');
  assert.ok(entry.pending);
  entry = commitJapaneseEntry(entry);
  assert.equal(entry.text, 'かん');
  assert.equal(entry.composition, null);
  entry = type(entry, 'na');
  assert.equal(entry.text, 'かんな');
  assert.deepEqual(entry.pending, { start: 2, end: 3 });
});

test('delimiters commit previous text and clipboard input never reopens committed words', () => {
  let entry = type(createJapaneseEntry(), 'ringo,');
  assert.equal(entry.pending, null);
  entry = type(entry, 'ame');
  assert.equal(matchJapaneseEntry(data, entry)?.range.query, 'あめ');
  entry = changeJapaneseEntry(entry, 'りんご、あめ 林檎', { start: 8, end: 8 }, 'hiragana', 'insertFromPaste');
  assert.equal(entry.pending, null);
  assert.equal(matchJapaneseEntry(data, entry), null);
});

test('editing committed text starts only a new segment and does not replace its neighbors', () => {
  let entry = createJapaneseEntry('私は林檎です。');
  entry = { ...entry, selection: { start: 2, end: 4 } };
  entry = type(entry, 'ame');
  assert.equal(entry.text, '私はあめです。');
  assert.deepEqual(entry.pending, { start: 2, end: 4 });
  assert.equal(insertJapaneseEntry(entry, matchJapaneseEntry(data, entry)!, data.notes[1]).text, '私は雨です。');
  const older = type(createJapaneseEntry(), 'ringo');
  const match = matchJapaneseEntry(data, older)!;
  assert.throws(() => insertJapaneseEntry(commitJapaneseEntry(older), match, data.notes[0]));
});

test('deletion, repeated kana, modes and native IME preserve text and pending ranges', () => {
  let entry = commitJapaneseEntry(type(createJapaneseEntry(), 'ka'));
  entry = type(entry, 'ka');
  assert.equal(entry.text, 'かか');
  assert.deepEqual(entry.pending, { start: 1, end: 2 });
  entry = changeJapaneseEntry(entry, 'か', { start: 1, end: 1 }, 'hiragana', 'deleteContentBackward');
  assert.equal(entry.pending, null);
  entry = type(entry, 'ringo', 'katakana');
  assert.equal(entry.text, 'かリンゴ');
  assert.equal(matchJapaneseEntry(data, entry)?.notes[0].id, 'apple');
  const native = changeJapaneseEntry(createJapaneseEntry('林檎'), '林檎あめ', { start: 4, end: 4 }, 'hiragana', 'insertCompositionText', true);
  assert.equal(native.text, '林檎あめ');
  assert.equal(commitJapaneseEntry(native).pending, null);
});
