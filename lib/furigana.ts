import { toHiragana } from 'wanakana';
import type { Note } from './model';

export type FuriganaPart = { text: string; reading?: string };

const kanjiPattern = /[\p{Script=Han}々〆]/u;
const kanaPattern = /[\p{Script=Hiragana}\p{Script=Katakana}\u3099\u309aー]/u;
const readingPattern = /^[\p{Script=Hiragana}\u3099\u309aー]+$/u;
const maximumReadingLength = 4096;
const maximumAlignmentWork = 262144;

export function hasKanji(text: string): boolean {
  return kanjiPattern.test(text);
}

export function normalizeFuriganaReading(value: string | undefined): string | undefined {
  if (!value || value.length > maximumReadingLength) return undefined;
  const first = value.normalize('NFKC').split(/[・、,，;；/／|｜\r\n]/, 1)[0].trim().replace(/[.．]/g, '');
  // Leave Latin text intact so a meaning or malformed reading cannot become ruby.
  const kana = toHiragana(first, { passRomaji: true }).normalize('NFC');
  return readingPattern.test(kana) && /\p{Script=Hiragana}/u.test(kana) ? kana : undefined;
}

type Token = { text: string; kind: 'kanji' | 'kana' | 'other'; anchor?: string; length?: number };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const character of text) {
    const kind = hasKanji(character) ? 'kanji' : kanaPattern.test(character) ? 'kana' : 'other';
    const last = tokens[tokens.length - 1];
    if (last?.kind === kind) last.text += character;
    else tokens.push({ text: character, kind });
  }
  for (const token of tokens) {
    if (token.kind === 'kana') {
      token.anchor = toHiragana(token.text.normalize('NFKC'), { passRomaji: true }).normalize('NFC');
      token.length = Array.from(token.anchor).length;
    }
  }
  return tokens;
}

function exactAlignment(text: string, reading: string): FuriganaPart[] | undefined {
  if (text !== '日本' && text !== '日本語') return undefined;
  const suffix = text === '日本語' ? 'ご' : '';
  const base = reading.slice(0, reading.length - suffix.length);
  if (!reading.endsWith(suffix) || (base !== 'にほん' && base !== 'にっぽん')) return undefined;
  const parts = base === 'にほん'
    ? [{ text: '日', reading: 'に' }, { text: '本', reading: 'ほん' }]
    : [{ text: '日', reading: 'にっ' }, { text: '本', reading: 'ぽん' }];
  if (suffix) parts.push({ text: '語', reading: suffix });
  return parts;
}

function appendPart(parts: FuriganaPart[], part: FuriganaPart): void {
  const last = parts[parts.length - 1];
  if (last && !last.reading && !part.reading) last.text += part.text;
  else parts.push(part);
}

function validateAlignment(text: string, reading: string, alignment: readonly FuriganaPart[]): FuriganaPart[] | undefined {
  if (!alignment.length || alignment.length > text.length) return undefined;
  const parts: FuriganaPart[] = [];
  let position = 0;
  let pronunciation = '';
  for (const part of alignment) {
    if (!part || typeof part.text !== 'string' || !part.text || !text.startsWith(part.text, position)) return undefined;
    position += part.text.length;
    if (part.reading !== undefined && typeof part.reading !== 'string') return undefined;
    const kana = normalizeFuriganaReading(part.reading);
    if (hasKanji(part.text)) {
      if (!kana) return undefined;
      pronunciation += kana;
      for (const refined of splitFurigana(part.text, kana)) appendPart(parts, refined);
    } else {
      const tokens = tokenize(part.text);
      if (tokens.some(token => token.kind === 'other' && /[\p{Letter}\p{Number}]/u.test(token.text))) return undefined;
      const plainKana = tokens.filter(token => token.kind === 'kana').map(token => token.anchor).join('');
      if (part.reading !== undefined && (!kana || kana !== normalizeFuriganaReading(plainKana))) return undefined;
      pronunciation += plainKana;
      appendPart(parts, { text: part.text });
    }
    if (pronunciation.length > maximumReadingLength) return undefined;
  }
  return position === text.length && normalizeFuriganaReading(pronunciation) === reading ? parts : undefined;
}

/** Align only unambiguous kana anchors; never invent individual kanji readings. */
export function splitFurigana(text: string, reading?: string, alignment?: readonly FuriganaPart[]): FuriganaPart[] {
  if (!text) return [];
  const plain = [{ text }];
  if (!hasKanji(text)) return plain;
  const kana = normalizeFuriganaReading(reading);
  if (!kana) return plain;
  const exact = exactAlignment(text, kana);
  if (exact) return exact;
  if (alignment) {
    const validated = validateAlignment(text, kana, alignment);
    if (validated) return validated;
  }
  const fallback = [{ text, reading: kana }];
  // Bound both the DP table and anchor comparisons before tokenizing large input.
  if (text.length * (kana.length + 1) > maximumAlignmentWork) return fallback;
  const tokens = tokenize(text);
  // Numbers and Latin letters can have spoken readings; skipping them would
  // incorrectly attribute their pronunciation to a neighbouring kanji.
  if (tokens.some(token => token.kind === 'other' && /[\p{Letter}\p{Number}]/u.test(token.text))) return fallback;
  const characters = Array.from(kana);
  const offsets = [0];
  for (const character of characters) offsets.push(offsets[offsets.length - 1] + character.length);
  const size = characters.length + 1;
  const ways = Array.from({ length: tokens.length + 1 }, () => new Uint8Array(size));
  ways[tokens.length][characters.length] = 1;
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index];
    const current = ways[index];
    const next = ways[index + 1];
    if (token.kind === 'kanji') {
      // A suffix sum counts all nonempty readings in linear time, capped at two.
      let count = 0;
      for (let position = characters.length - 1; position >= 0; position--) {
        count = Math.min(2, count + next[position + 1]);
        current[position] = count;
      }
    } else if (token.kind === 'kana') {
      const length = token.length!;
      for (let position = 0; position + length < size; position++) {
        if (kana.startsWith(token.anchor!, offsets[position])) current[position] = next[position + length];
      }
    } else {
      current.set(next);
    }
  }
  if (ways[0][0] !== 1) return fallback;
  const parts: FuriganaPart[] = [];
  let position = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind === 'kanji') {
      let end = position + 1;
      while (!ways[index + 1][end]) end++;
      const tokenReading = characters.slice(position, end).join('');
      parts.push(...(exactAlignment(token.text, tokenReading) ?? [{ text: token.text, reading: tokenReading }]));
      position = end;
    } else {
      const last = parts[parts.length - 1];
      if (last && !last.reading) last.text += token.text;
      else parts.push({ text: token.text });
      if (token.kind === 'kana') position += token.length!;
    }
  }
  return parts;
}

/** Saved vocabulary only: first active, valid reading wins for homographs. */
export function buildReadingIndex(notes: readonly Pick<Note, 'japanese' | 'reading' | 'deletedAt'>[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const note of notes) {
    if (note.deletedAt) continue;
    const text = note.japanese.trim();
    if (!text || index.has(text)) continue;
    const reading = normalizeFuriganaReading(note.reading);
    if (reading) index.set(text, reading);
  }
  return index;
}

export function readingForText(text: string, index: ReadonlyMap<string, string>): string | undefined {
  return index.get(text.trim());
}
