import { writingSuggestions } from './japanese-search';
import type { Note, Snapshot } from './model';

export type WritingToken = { start: number; end: number; query: string };

const latin = /[\p{Script=Latin}\p{M}'’\-]+$/u;
const latinAhead = /^[\p{Script=Latin}\p{M}'’\-]*/u;
const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々〆ヶヵ]+$/u;

function validOffset(text: string, offset: number): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset <= text.length
    && !(offset > 0 && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset] ?? ''));
}

/** Offsets use the same UTF-16 coordinates as textarea.selectionStart. */
export function writingToken(text: string, start: number, end = start): WritingToken | null {
  if (start !== end || !validOffset(text, start) || !validOffset(text, end)) return null;
  const before = text.slice(0, start);
  const roman = before.match(latin)?.[0];
  const query = roman ?? before.match(japanese)?.[0];
  if (!query || query.length > 1000 || /^['’\-]+$/.test(query)) return null;
  // Japanese has no explicit word boundary: never infer away text after the caret.
  const tail = roman ? text.slice(start).match(latinAhead)?.[0] ?? '' : '';
  return { start: start - query.length, end: start + tail.length, query };
}

export function applySuggestion(text: string, range: WritingToken, word: string): { text: string; caret: number } {
  if (!validOffset(text, range.start) || !validOffset(text, range.end) || range.start > range.end
    || !range.query || range.start + range.query.length > range.end
    || text.slice(range.start, range.start + range.query.length) !== range.query || !word) {
    throw new Error('La position de la suggestion a changé.');
  }
  return { text: text.slice(0, range.start) + word + text.slice(range.end), caret: range.start + word.length };
}

export function writingMatches(data: Snapshot, text: string, start: number, end = start): { range: WritingToken; notes: Note[] } | null {
  const token = writingToken(text, start, end);
  if (!token) return null;
  const notes = writingSuggestions(data, token.query);
  if (notes.length) return { range: token, notes };
  // Unspaced Japanese can include a preceding particle: 私はりんご → りんご.
  if (/^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々〆ヶヵ]+$/u.test(token.query)) {
    const characters = Array.from(token.query);
    let offset = 0;
    for (let index = 0; index < Math.min(characters.length - 1, 40); index++) {
      offset += characters[index].length;
      const query = token.query.slice(offset);
      const matches = writingSuggestions(data, query);
      if (matches.length) return { range: { ...token, start: token.start + offset, query }, notes: matches };
    }
  }
  return null;
}
