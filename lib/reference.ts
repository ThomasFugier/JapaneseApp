import { toHiragana, toKatakana, toRomaji } from 'wanakana';
import dictionary from './kanji-reference.json';

export type KanjiEntry = { character: string; meanings: string[]; on: string[]; kun: string[]; grade: number; strokes: number };
export type KanaEntry = { hiragana: string; katakana: string; romaji: string; note?: string };
export type KanaGroup = { title: string; columns: number; entries: (KanaEntry | null)[] };

const kana = (value: string): KanaEntry => ({ hiragana: value, katakana: toKatakana(value), romaji: value === 'っ' ? 'pause' : toRomaji(value) });
const rows = (text: string) => text.split(' ').map(value => value === '-' ? null : kana(value));
export const kanaGroups: KanaGroup[] = [
  { title: 'Basic · gojūon', columns: 5, entries: rows('あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や - ゆ - よ ら り る れ ろ わ - - - を ん - - - -') },
  { title: 'Voiced sounds · dakuten & handakuten', columns: 5, entries: rows('が ぎ ぐ げ ご ざ じ ず ぜ ぞ だ ぢ づ で ど ば び ぶ べ ぼ ぱ ぴ ぷ ぺ ぽ') },
  { title: 'Combinations · yōon', columns: 3, entries: rows('きゃ きゅ きょ しゃ しゅ しょ ちゃ ちゅ ちょ にゃ にゅ にょ ひゃ ひゅ ひょ みゃ みゅ みょ りゃ りゅ りょ ぎゃ ぎゅ ぎょ じゃ じゅ じょ びゃ びゅ びょ ぴゃ ぴゅ ぴょ') },
];
export const smallKana: KanaEntry[] = ['ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', 'ゅ', 'ょ', 'っ'].map(value => ({ ...kana(value), note: value === 'っ' ? 'Small tsu marks a brief pause and doubles the next consonant: きって (kitte).' : 'A small kana combines with the preceding sound; it is not a separate full syllable.' }));
export const loanKana = rows('ふぁ ふぃ ふぇ ふぉ てぃ でぃ とぅ どぅ しぇ じぇ ちぇ うぃ うぇ うぉ ゔ ゔぁ ゔぃ ゔぇ ゔぉ').filter((entry): entry is KanaEntry => !!entry);
export const kanjiEntries: KanjiEntry[] = dictionary;

function clean(text: string) { return text.normalize('NFKC').toLowerCase().trim(); }
function readingKey(text: string) { return toHiragana(clean(text).replace(/[.\-\s]/g, '')); }
const kanjiIndex = kanjiEntries.map(entry => ({ entry, meanings: entry.meanings.map(clean), readings: [...entry.on, ...entry.kun].map(readingKey) }));

export function searchKanji(query: string, grade = 'all'): KanjiEntry[] {
  const text = clean(query); const reading = readingKey(text);
  return kanjiIndex.flatMap(({ entry, meanings, readings }) => {
    if (grade !== 'all' && (grade === 'secondary' ? entry.grade !== 8 : entry.grade !== Number(grade))) return [];
    if (!text) return [{ entry, score: 0 }];
    const score = entry.character === text ? 5 : text.includes(entry.character) ? 4 : meanings.includes(text) || readings.includes(reading) ? 3 : meanings.some(value => value.includes(text)) || readings.some(value => value.startsWith(reading)) ? 1 : 0;
    return score ? [{ entry, score }] : [];
  }).sort((a, b) => b.score - a.score || a.entry.grade - b.entry.grade || a.entry.strokes - b.entry.strokes).map(({ entry }) => entry);
}

export function matchesKana(entry: KanaEntry, query: string) {
  const text = clean(query);
  return !text || entry.hiragana === readingKey(text) || entry.romaji.startsWith(text) || entry.hiragana.includes(text) || entry.katakana.includes(text);
}

export function gradeLabel(grade: number) { return grade === 8 ? 'Secondary school' : `Grade ${grade}`; }
