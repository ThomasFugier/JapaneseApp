import test from 'node:test';
import assert from 'node:assert/strict';
import { kanjiEntries, searchKanji, kanaGroups, matchesKana } from '../lib/reference';

test('reference contains the 2,136 distinct joyo kanji with dictionary fields', () => {
  assert.equal(kanjiEntries.length, 2136);
  assert.equal(new Set(kanjiEntries.map(entry => entry.character)).size, 2136);
  assert.ok(kanjiEntries.every(entry => entry.meanings.length && entry.strokes > 0));
});
test('kanji search accepts English, kanji, hiragana, katakana and romaji', () => {
  for (const query of ['食', 'eat', 'たべる', 'タベル', 'taberu', 'ＴＡＢＥＲＵ']) assert.ok(searchKanji(query).some(entry => entry.character === '食'), query);
  assert.equal(searchKanji('日')[0].character, '日');
  assert.ok(searchKanji('日本').some(entry => entry.character === '日'));
  assert.ok(searchKanji('日本').some(entry => entry.character === '本'));
});
test('school filters and empty search results are deterministic', () => {
  assert.equal(searchKanji('', '1').length, 80);
  assert.ok(searchKanji('', 'secondary').every(entry => entry.grade === 8));
  assert.equal(searchKanji('zzzzzz').length, 0);
  assert.equal(searchKanji('', 'all').length, 2136);
});
test('basic kana has all 46 sounds and accepts romanization aliases', () => {
  const basic = kanaGroups[0].entries.filter(entry => entry !== null);
  assert.equal(basic.length, 46);
  assert.equal(new Set(basic.map(entry => entry.hiragana)).size, 46);
  const shi = basic.find(entry => entry.hiragana === 'し')!;
  for (const query of ['shi', 'si', 'し', 'シ']) assert.ok(matchesKana(shi, query));
  assert.equal(matchesKana(shi, 'ka'), false);
});
