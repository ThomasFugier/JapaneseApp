import test from 'node:test';
import assert from 'node:assert/strict';
import { applySuggestion, writingMatches, writingToken } from '../lib/writing';
import { emptySnapshot } from '../lib/model';

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
