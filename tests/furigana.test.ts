import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadingIndex, hasKanji, normalizeFuriganaReading, readingForText, splitFurigana } from '../lib/furigana';

test('kanji detection includes iteration marks and supplementary Han', () => {
  for (const text of ['食べる', '々', '〆', '𠮷']) assert.equal(hasKanji(text), true, text);
  for (const text of ['', 'ひらがな', 'カタカナ', '🍵!']) assert.equal(hasKanji(text), false, text);
});

test('kana anchors isolate kanji readings without splitting compounds', () => {
  assert.deepEqual(splitFurigana('食べる', 'たべる'), [{ text: '食', reading: 'た' }, { text: 'べる' }]);
  assert.deepEqual(splitFurigana('お茶', 'おちゃ'), [{ text: 'お' }, { text: '茶', reading: 'ちゃ' }]);
  assert.deepEqual(splitFurigana('取り消す', 'とりけす'), [
    { text: '取', reading: 'と' }, { text: 'り' }, { text: '消', reading: 'け' }, { text: 'す' },
  ]);
  assert.deepEqual(splitFurigana('今日', 'きょう'), [{ text: '今日', reading: 'きょう' }]);
  assert.deepEqual(splitFurigana('日本語', 'にほんご'), [
    { text: '日', reading: 'に' }, { text: '本', reading: 'ほん' }, { text: '語', reading: 'ご' },
  ]);
});

test('explicit Japan readings use per-kanji blocks while irregular words stay grouped', () => {
  assert.deepEqual(splitFurigana('日本', 'にほん'), [{ text: '日', reading: 'に' }, { text: '本', reading: 'ほん' }]);
  assert.deepEqual(splitFurigana('日本', 'にっぽん'), [{ text: '日', reading: 'にっ' }, { text: '本', reading: 'ぽん' }]);
  assert.deepEqual(splitFurigana('日本語', 'ニッポンゴ'), [
    { text: '日', reading: 'にっ' }, { text: '本', reading: 'ぽん' }, { text: '語', reading: 'ご' },
  ]);
  assert.deepEqual(splitFurigana('日本へ', 'にほんへ'), [
    { text: '日', reading: 'に' }, { text: '本', reading: 'ほん' }, { text: 'へ' },
  ]);
  for (const [text, reading] of [['今日', 'きょう'], ['大人', 'おとな'], ['明日', 'あした'], ['日本', 'ひのもと']]) {
    assert.deepEqual(splitFurigana(text, reading), [{ text, reading }]);
  }
});

test('trusted exact alignment supplies independent kanji blocks and preserves plain text', () => {
  assert.deepEqual(splitFurigana('勉強', 'べんきょう', [
    { text: '勉', reading: 'ベン' }, { text: '強', reading: 'キョウ' },
  ]), [{ text: '勉', reading: 'べん' }, { text: '強', reading: 'きょう' }]);
  const text = ' 「勉強する」💡';
  const aligned = splitFurigana(text, 'べんきょうする', [
    { text: ' 「' }, { text: '勉', reading: 'べん' }, { text: '強', reading: 'きょう' },
    { text: 'する', reading: 'スル' }, { text: '」💡' },
  ]);
  assert.deepEqual(aligned, [
    { text: ' 「' }, { text: '勉', reading: 'べん' }, { text: '強', reading: 'きょう' }, { text: 'する」💡' },
  ]);
  assert.equal(aligned.map(part => part.text).join(''), text);
  assert.deepEqual(splitFurigana('食べる', 'たべる', [{ text: '食べる', reading: 'たべる' }]), [
    { text: '食', reading: 'た' }, { text: 'べる' },
  ]);
});

test('invalid supplied alignment falls back without losing text or guessing divisions', () => {
  for (const alignment of [
    [], [{ text: '勉', reading: 'べん' }], [{ text: '勉学', reading: 'べんきょう' }],
    [{ text: '勉' }, { text: '強', reading: 'べんきょう' }],
    [{ text: '勉', reading: 'べん' }, { text: '強', reading: 'がく' }],
    [{ text: '勉', reading: 'invalid' }, { text: '強', reading: 'きょう' }],
  ]) assert.deepEqual(splitFurigana('勉強', 'べんきょう', alignment), [{ text: '勉強', reading: 'べんきょう' }]);
  assert.deepEqual(splitFurigana('食べる', 'たべる', [
    { text: '食', reading: 'たべ' }, { text: 'べる', reading: 'る' },
  ]), [{ text: '食', reading: 'た' }, { text: 'べる' }]);
  assert.deepEqual(splitFurigana('カナ', 'かな', [{ text: 'カナ', reading: 'かな' }]), [{ text: 'カナ' }]);
});

test('readings normalize katakana, width, boundary dots and first alternatives', () => {
  assert.equal(normalizeFuriganaReading('ﾀ.ﾍﾞﾙ・ｸｳ'), 'たべる');
  assert.equal(normalizeFuriganaReading('taberu'), undefined);
  for (const reading of ['タベル', 'ﾀﾍﾞﾙ', 'た.べる', 'た．べる', 'たべる・くう', 'たべる、くう', 'たべる / くう', 'たべる | くう']) {
    assert.deepEqual(splitFurigana('食べる', reading), [{ text: '食', reading: 'た' }, { text: 'べる' }], reading);
  }
  assert.deepEqual(splitFurigana('漢カナ', 'カンカナ'), [{ text: '漢', reading: 'かん' }, { text: 'カナ' }]);
});

test('contractions and irregular okurigana align only where the saved reading permits', () => {
  assert.deepEqual(splitFurigana('行った', 'いった'), [{ text: '行', reading: 'い' }, { text: 'った' }]);
  assert.deepEqual(splitFurigana('大人しい', 'おとなしい'), [{ text: '大人', reading: 'おとな' }, { text: 'しい' }]);
  assert.deepEqual(splitFurigana('引っ越す', 'ひっこす'), [
    { text: '引', reading: 'ひ' }, { text: 'っ' }, { text: '越', reading: 'こ' }, { text: 'す' },
  ]);
  assert.deepEqual(splitFurigana('食べる', 'くう'), [{ text: '食べる', reading: 'くう' }]);
  assert.deepEqual(splitFurigana('お茶', 'ちゃ'), [{ text: 'お茶', reading: 'ちゃ' }]);
  assert.deepEqual(splitFurigana('3月', 'さんがつ'), [{ text: '3月', reading: 'さんがつ' }]);
  assert.deepEqual(splitFurigana('A型', 'えーがた'), [{ text: 'A型', reading: 'えーがた' }]);
});

test('punctuation, whitespace, emoji and original kana survive untouched', () => {
  const text = ' \t「お茶」🍵\n';
  const parts = splitFurigana(text, 'おちゃ');
  assert.deepEqual(parts, [{ text: ' \t「お' }, { text: '茶', reading: 'ちゃ' }, { text: '」🍵\n' }]);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.deepEqual(splitFurigana('食べる', 'たべる'), [{ text: '食', reading: 'た' }, { text: 'べる' }]);
});

test('empty, kana-only and malformed readings stay plain', () => {
  assert.deepEqual(splitFurigana('', 'から'), []);
  assert.deepEqual(splitFurigana('かな', 'カナ'), [{ text: 'かな' }]);
  for (const reading of [undefined, '', ' ', 'eat', 'taberu', 'たべる?', '食べる', 'た べる', 'ー', 'invalid・たべる']) {
    assert.deepEqual(splitFurigana('食べる', reading), [{ text: '食べる' }], String(reading));
  }
});

test('repeated anchors require a unique complete alignment', () => {
  assert.deepEqual(splitFurigana('組み込み', 'くみこみ'), [
    { text: '組', reading: 'く' }, { text: 'み' }, { text: '込', reading: 'こ' }, { text: 'み' },
  ]);
  assert.deepEqual(splitFurigana('漢あ字', 'かあきあく'), [{ text: '漢あ字', reading: 'かあきあく' }]);
  const text = '漢あ'.repeat(100) + '字';
  const reading = 'かあ'.repeat(150) + 'き';
  assert.deepEqual(splitFurigana(text, reading), [{ text, reading }]);
  const huge = '漢あ'.repeat(2000);
  assert.deepEqual(splitFurigana(huge, 'かあ'.repeat(1000)), [{ text: huge, reading: 'かあ'.repeat(1000) }]);
});

test('reading index uses active notes and the first valid reading without inferring compounds', () => {
  const index = buildReadingIndex([
    { japanese: '今日', reading: 'こんにち', deletedAt: '2026-11-09T10:00:00.000Z' },
    { japanese: '今日', reading: 'invalid' },
    { japanese: '今日', reading: 'キョウ・コンニチ' },
    { japanese: '今日', reading: 'こんにち' },
    { japanese: '食べる', reading: 'た.べる' },
    { japanese: '日本', reading: 'にほん' },
    { japanese: '語', reading: 'ご' },
    { japanese: '無効', reading: 'bad reading' },
    { japanese: ' ', reading: 'から' },
  ]);
  assert.deepEqual([...index], [['今日', 'きょう'], ['食べる', 'たべる'], ['日本', 'にほん'], ['語', 'ご']]);
  assert.equal(readingForText(' 今日 ', index), 'きょう');
  assert.equal(readingForText('日本語', index), undefined);
});
