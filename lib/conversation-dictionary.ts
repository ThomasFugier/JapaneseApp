import { toHiragana } from 'wanakana';
import type { ReadingToken } from './furigana-client';
import type { ConversationWord } from './conversation-words';

export type DictionaryEntry = { id: string; kanji: string[]; readings: string[]; senses: { pos: string[]; gloss: string[] }[]; language: 'fre' | 'eng' };
export type DictionaryShard = Record<string, DictionaryEntry[]>;
export const dictionaryKey = (text: string) => text.normalize('NFKC');
export function dictionaryShard(word: string): string {
  let hash = 0x811c9dc5;
  for (const character of word) {
    const point = character.codePointAt(0)!;
    hash = Math.imul(hash ^ (point & 0xff), 0x01000193);
    if (point > 0xff) hash = Math.imul(hash ^ (point >>> 8), 0x01000193);
    if (point > 0xffff) hash = Math.imul(hash ^ (point >>> 16), 0x01000193);
  }
  return ((hash >>> 0) % 64).toString(16).padStart(2, '0');
}

const parts: Record<string, [string, RegExp]> = {
  '名詞': ['nom', /^(n(?:$|-)|num$)/], '動詞': ['verbe', /^v/], '形容詞': ['adjectif', /^adj/], '形容動詞': ['adjectif', /^adj-na$/],
  '副詞': ['adverbe', /^adv/], '助詞': ['particule', /^prt$/], '助動詞': ['auxiliaire', /^(aux|cop)/],
  '接続詞': ['conjonction', /^conj$/], '感動詞': ['interjection', /^int$/], '接頭詞': ['préfixe', /^pref$/],
};

export function wordLookupKeys(token: ReadingToken): string[] {
  return [...new Set([token.lemma || token.text, token.text, token.reading ? toHiragana(token.reading) : ''].map(dictionaryKey).filter(Boolean))];
}

export function dictionaryWord(token: ReadingToken, entries: DictionaryEntry[]): ConversationWord {
  const lemma = token.lemma || token.text;
  const reading = token.reading && token.reading !== '*' ? toHiragana(token.reading) : /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(token.text) ? toHiragana(token.text) : '';
  const part = parts[token.partOfSpeech || ''];
  const score = (entry: DictionaryEntry) => {
    const spellings = [...entry.kanji, ...entry.readings];
    const exact = spellings.includes(lemma) ? 50 : spellings.includes(token.text) ? 35 : 0;
    const compatible = part && entry.senses.some(sense => sense.pos.some(pos => part[1].test(pos)));
    return exact + (compatible ? 30 : part ? -15 : 0) + (entry.readings.includes(reading) ? 12 : 0) + (entry.language === 'fre' ? 1 : 0);
  };
  const written = new Set([lemma, token.text].map(dictionaryKey));
  // A pronunciation alone cannot turn an unknown name into a homophone's
  // definition. An actual spelling/lemma match is required.
  const candidates = [...new Map(entries.map(entry => [entry.id, entry])).values()]
    .filter(entry => [...entry.kanji, ...entry.readings].some(spelling => written.has(dictionaryKey(spelling))))
    .filter(entry => !part || entry.senses.some(sense => sense.pos.some(pos => part[1].test(pos))))
    .sort((a, b) => score(b) - score(a));
  const entry = candidates[0];
  const matchingSenses = entry && part ? entry.senses.filter(sense => sense.pos.some(pos => part[1].test(pos))) : [];
  const senses = matchingSenses.length ? matchingSenses : entry?.senses ?? [];
  const definitions = [...new Set(senses[0]?.gloss ?? [])].slice(0, 4).map(text => text.slice(0, 300));
  const dictionaryReading = entry?.readings.find(value => value === reading) || entry?.readings.find(value => reading && value[0] === reading[0]) || entry?.readings[0] || reading;
  return { text: token.text, lemma, reading, dictionaryReading, partOfSpeech: part?.[0] ?? '', definitions, language: entry ? entry.language === 'fre' ? 'fr' : 'en' : null, source: entry ? 'JMdict' : null };
}
