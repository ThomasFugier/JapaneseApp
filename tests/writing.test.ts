import test from 'node:test';
import assert from 'node:assert/strict';
import { applySuggestion, writingMatches, writingToken } from '../lib/writing';
import { emptySnapshot } from '../lib/model';
import { convertWritingInput } from '../lib/kana-input';

test('writing completion replaces only a Latin word after Japanese text', () => {
  const text = '私はringoを食べる。';
  const range = writingToken(text, 7);
  assert.deepEqual(range, { start: 2, end: 7, query: 'ringo' });
  assert.deepEqual(applySuggestion(text, range!, '林檎'), { text: '私は林檎を食べる。', caret: 4 });
});

test('caret in the middle of a word replaces its entire word without consuming the next one', () => {
  const text = 'bonjour ringo demain';
  const range = writingToken(text, 11);
  assert.deepEqual(range, { start: 8, end: 13, query: 'rin' });
  assert.equal(applySuggestion(text, range!, '林檎').text, 'bonjour 林檎 demain');
});

test('punctuation, newlines and selection boundaries remain intact', () => {
  const text = 'ringo,\nnomu!';
  assert.deepEqual(writingToken(text, 11), { start: 7, end: 11, query: 'nomu' });
  assert.equal(applySuggestion(text, writingToken(text, 11)!, '飲む').text, 'ringo,\n飲む!');
  assert.equal(writingToken(text, 6), null);
  assert.equal(writingToken(text, 0, 5), null);
  assert.equal(writingToken(text, -1), null);
  assert.equal(writingToken(text, 100), null);
});

test('UTF-16 caret offsets do not split emoji and HTML remains plain text', () => {
  const text = '🍎 ringo <script>alert(1)</script>';
  assert.equal(writingToken(text, 1), null);
  const range = writingToken(text, 8)!;
  assert.deepEqual(range, { start: 3, end: 8, query: 'ringo' });
  assert.equal(applySuggestion(text, range, '林檎').text, '🍎 林檎 <script>alert(1)</script>');
});

test('a stale suggestion cannot overwrite text at a changed caret range', () => {
  assert.throws(() => applySuggestion('nomu', { start: 0, end: 4, query: 'ringo' }, '林檎'));
  assert.throws(() => applySuggestion('ringo', { start: 0, end: 99, query: 'ringo' }, '林檎'));
});

test('unspaced Japanese completion preserves preceding text and uses saved notes only', () => {
  const data = emptySnapshot();
  data.notes.push({ id: 'apple', japanese: '林檎', reading: 'りんご', meaning: 'Pomme', example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: '2026-11-09T00:00:00Z' });
  data.cards.push({ id: 'apple-card', noteId: 'apple', deckIds: [], direction: 'ja-fr', updatedAt: '2026-11-09T00:00:00Z' });
  const match = writingMatches(data, '私はりんご', 5)!;
  assert.equal(match.notes[0].id, 'apple');
  assert.deepEqual(applySuggestion('私はりんご', match.range, '林檎'), { text: '私は林檎', caret: 4 });
  const middle = writingMatches(data, '私はりんごを食べる', 5)!;
  assert.deepEqual(applySuggestion('私はりんごを食べる', middle.range, '林檎'), { text: '私は林檎を食べる', caret: 4 });
  assert.equal(writingMatches(emptySnapshot(), 'ringo', 5), null);
});

test('live kana with a pending consonant still suggests the whole saved word', () => {
  const data = emptySnapshot();
  data.notes.push({ id: 'apple', japanese: '林檎', reading: 'りんご', meaning: 'Pomme', example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: '2026-11-09T00:00:00Z' });
  data.cards.push({ id: 'apple-card', noteId: 'apple', deckIds: [], direction: 'ja-fr', updatedAt: '2026-11-09T00:00:00Z' });
  for (const text of ['りn', 'りんg', '私はりんg']) {
    const match = writingMatches(data, text, text.length)!;
    assert.equal(match.notes[0].id, 'apple', text);
    assert.equal(applySuggestion(text, match.range, '林檎').text, text.startsWith('私') ? '私は林檎' : '林檎');
  }
});

function prefixFixture() {
  const data = emptySnapshot();
  data.notes = [
    { id: 'genki', japanese: '元気', reading: 'げんき' },
    { id: 'family', japanese: '家族', reading: 'かぞく' },
    { id: 'apple', japanese: '林檎', reading: 'りんご' },
  ].map(note => ({ ...note, meaning: note.id, example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: '2026-11-09T00:00:00Z' }));
  data.cards = data.notes.map(note => ({ id: note.id, noteId: note.id, deckIds: [], direction: 'ja-fr', updatedAt: note.updatedAt }));
  return data;
}

test('live ogenki input preserves its honorific when converting the saved word', () => {
  const converted = convertWritingInput('', 'ogenki', 6, 'hiragana', 'insertText', null);
  assert.equal(converted.text, 'おげんき');
  const match = writingMatches(prefixFixture(), converted.text, converted.caret)!;
  assert.equal(match.notes[0].id, 'genki');
  assert.deepEqual(match.range, { start: 1, end: 4, query: 'げんき' });
  assert.deepEqual(applySuggestion(converted.text, match.range, '元気'), { text: 'お元気', caret: 3 });
});

test('prefix preservation keeps particles, suffixes, katakana and UTF-16 offsets intact', () => {
  const data = prefixFixture();
  for (const [text, caret, expected, end] of [
    ['私はおげんきです。', 6, '私はお元気です。', 5],
    ['🍎おげんき', 6, '🍎お元気', 5],
    ['オゲンキ', 4, 'オ元気', 3],
    ['おげんk', 4, 'お元気', 3],
    ['ごかぞく', 4, 'ご家族', 3],
  ] as const) {
    const match = writingMatches(data, text, caret)!;
    const word = text.startsWith('ご') ? '家族' : '元気';
    assert.deepEqual(applySuggestion(text, match.range, word), { text: expected, caret: end }, text);
  }
});

test('each suggestion has its own span so explicit and implicit honorifics are not doubled or erased', () => {
  const data = prefixFixture();
  data.notes.push({ ...data.notes[0], id: 'polite', japanese: 'お元気', reading: 'おげんき' });
  data.cards.push({ ...data.cards[0], id: 'polite', noteId: 'polite' });
  const match = writingMatches(data, 'おげんき', 4)!;
  assert.equal(match.notes[0].id, 'polite');
  for (const id of ['polite', 'genki']) {
    const note = match.notes.find(note => note.id === id)!;
    assert.ok(note);
    assert.deepEqual(applySuggestion('おげんき', match.ranges.get(id)!, note.japanese), { text: 'お元気', caret: 3 });
  }
});

test('substring-only suffixes never retain the typo that fuzzy matching should correct', () => {
  const data = prefixFixture();
  for (const text of ['rango', 'らんご', 'ランゴ', '私はらんご']) {
    const match = writingMatches(data, text, text.length)!;
    assert.equal(match.notes[0].id, 'apple');
    assert.equal(applySuggestion(text, match.range, '林檎').text, text.startsWith('私') ? '私は林檎' : '林檎', text);
  }
});

test('a changed prefix-preserving range still rejects stale input', () => {
  const match = writingMatches(prefixFixture(), 'おげんき', 4)!;
  assert.throws(() => applySuggestion('おてんき', match.range, '元気'));
});

test('a saved spelling that already contains the prefix never receives it twice', () => {
  const data = prefixFixture();
  data.notes[0].japanese = 'お元気';
  for (const text of ['おげんき', 'オゲンキ']) {
    const match = writingMatches(data, text, text.length)!;
    assert.equal(applySuggestion(text, match.ranges.get('genki')!, 'お元気').text, 'お元気');
  }
});

test('a fuzzy phrase suffix cannot hide the base word behind a longer polite entry', () => {
  for (const reading of ['おげんき', 'げんき']) {
    const data = prefixFixture();
    data.notes.push({ ...data.notes[0], id: 'polite', japanese: 'お元気', reading });
    data.cards.push({ ...data.cards[0], id: 'polite', noteId: 'polite' });
    const text = '私はおげんきです。';
    const match = writingMatches(data, text, 6)!;
    for (const id of ['polite', 'genki']) {
      const note = match.notes.find(note => note.id === id)!;
      assert.ok(note, `${reading}: ${id}`);
      assert.deepEqual(applySuggestion(text, match.ranges.get(id)!, note.japanese), { text: '私はお元気です。', caret: 5 });
    }
    data.notes.push({ ...data.notes[0], id: 'rice', japanese: 'ご飯', reading: 'ごはん' });
    data.cards.push({ ...data.cards[0], id: 'rice', noteId: 'rice' });
    const typo = writingMatches(data, '私はらんご', 5)!;
    assert.equal(typo.notes[0].id, 'apple');
    assert.equal(applySuggestion('私はらんご', typo.range, '林檎').text, '私は林檎');
  }
});
