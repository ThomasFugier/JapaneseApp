import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { splitFurigana, type FuriganaPart } from '../lib/furigana';

type Entry = [string, string, [string, string?][]];
const data = JSON.parse(gunzipSync(readFileSync(new URL('../public/furigana/alignments-v1.json.gz', import.meta.url))).toString()) as { entries: Entry[] };
const dictionary = new Map(data.entries.map(([text, reading, parts]) => [`${text}\0${reading}`, parts.map(([text, reading]) => ({ text, reading }))]));
const lookup = (text: string, reading: string) => dictionary.get(`${text}\0${reading}`);

test('bundled dictionary aligns real compounds per kanji, including sound changes', () => {
  const words: [string, string, string[]][] = [
    ['学校', 'がっこう', ['がっ', 'こう']],
    ['新聞', 'しんぶん', ['しん', 'ぶん']],
    ['勉強', 'べんきょう', ['べん', 'きょう']],
    ['図書館', 'としょかん', ['と', 'しょ', 'かん']],
    ['先生', 'せんせい', ['せん', 'せい']],
    ['日本語', 'にほんご', ['に', 'ほん', 'ご']],
  ];
  for (const [text, reading, expected] of words) {
    const actual = splitFurigana(text, reading, lookup(text, reading));
    assert.deepEqual(actual.map(part => part.text), Array.from(text));
    assert.deepEqual(actual.map(part => part.reading), expected);
  }
});

test('dictionary alignment is selected by pronunciation and keeps indivisible readings', () => {
  assert.deepEqual(splitFurigana('今日', 'きょう', lookup('今日', 'きょう')), [{ text: '今日', reading: 'きょう' }]);
  assert.deepEqual(splitFurigana('今日', 'こんにち', lookup('今日', 'こんにち')), [{ text: '今', reading: 'こん' }, { text: '日', reading: 'にち' }]);
  assert.deepEqual(splitFurigana('大人', 'おとな', lookup('大人', 'おとな')), [{ text: '大人', reading: 'おとな' }]);
});

test('bundled alignment preserves every source surface and full pronunciation', () => {
  assert.ok(data.entries.length > 100000);
  for (const [text, reading, parts] of data.entries) {
    assert.equal(parts.map(part => part[0]).join(''), text);
    assert.equal(parts.map(part => part[1] || part[0]).join(''), reading);
  }
});
