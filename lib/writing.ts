import { toHiragana } from 'wanakana';
import { writingSuggestionRank, writingSuggestions } from './japanese-search';
import type { Note, Snapshot } from './model';

export type WritingToken = { start: number; end: number; query: string };
export type WritingMatch = { range: WritingToken; notes: Note[]; ranges: ReadonlyMap<string, WritingToken> };
const japaneseQuery = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々〆ヶヵ]+[a-z]*$/iu;

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
  const pending = roman && /^[bcdfghjklmnpqrstvwxyz]{1,3}$/i.test(roman)
    ? before.slice(0, -roman.length).match(japanese)?.[0] : '';
  const query = pending ? pending + roman : roman ?? before.match(japanese)?.[0];
  if (!query || query.length > 1000 || /^['’\-]+$/.test(query)) return null;
  // Japanese has no explicit word boundary: never infer away text after the caret.
  const tail = roman ? text.slice(start).match(latinAhead)?.[0] ?? '' : '';
  return { start: start - query.length, end: start + tail.length, query };
}

export function applySuggestion(text: string, range: WritingToken, word: string): { text: string; caret: number } {
  if (!validOffset(text, range.start) || !validOffset(text, range.end) || range.start > range.end
    || !range.query || range.start + range.query.length > range.end
    || text.slice(range.start, range.start + range.query.length) !== range.query || !word) {
    throw new Error('The suggestion position has changed.');
  }
  return { text: text.slice(0, range.start) + word + text.slice(range.end), caret: range.start + word.length };
}

function matchedRanges(defaultRange: WritingToken, notes: Note[], originalRanges?: ReadonlyMap<string, WritingToken>): WritingMatch {
  const ranges = new Map<string, WritingToken>();
  for (const note of notes) {
    const range = originalRanges?.get(note.id) ?? defaultRange;
    let best = range;
    let rank = writingSuggestionRank(note, range.query);
    // A real suffix is stronger than treating the whole phrase as a typo.
    // Only exact/prefix matches qualify: らんご must still correct to 林檎.
    if (rank >= 100 && japaneseQuery.test(range.query)) {
      const characters = Array.from(range.query);
      let offset = 0;
      for (let index = 0; index < Math.min(characters.length - 1, 40); index++) {
        offset += characters[index].length;
        const query = range.query.slice(offset);
        if (Array.from(query.replace(/[a-z]+$/iu, '')).length < 2) break;
        if (toHiragana(note.japanese).startsWith(toHiragana(range.query.slice(0, offset)))) continue;
        const candidate = writingSuggestionRank(note, query);
        if (candidate < 20 && candidate < rank) {
          best = { ...range, start: range.start + offset, query };
          rank = candidate;
        }
      }
    }
    ranges.set(note.id, best);
  }
  return { range: ranges.get(notes[0].id)!, notes, ranges };
}

export function writingMatches(data: Snapshot, text: string, start: number, end = start): WritingMatch | null {
  const token = writingToken(text, start, end);
  if (!token) return null;
  const notes = writingSuggestions(data, token.query);
  if (notes.length) return matchedRanges(token, notes);
  // Unspaced Japanese can include a preceding particle: 私はりんご → りんご.
  if (japaneseQuery.test(token.query)) {
    const characters = Array.from(token.query);
    const originalRanges = new Map<string, WritingToken>();
    let fallback: WritingMatch | null = null;
    let offset = 0;
    for (let index = 0; index < Math.min(characters.length - 1, 40); index++) {
      offset += characters[index].length;
      const query = token.query.slice(offset);
      if (fallback && Array.from(query.replace(/[a-z]+$/iu, '')).length < 2) break;
      const matches = writingSuggestions(data, query);
      if (!matches.length) continue;
      const range = { ...token, start: token.start + offset, query };
      for (const note of matches) if (!originalRanges.has(note.id)) originalRanges.set(note.id, range);
      const match = matchedRanges(range, matches, originalRanges);
      if (matches.some(note => writingSuggestionRank(note, query) < 20)) return match;
      fallback ??= match;
    }
    return fallback;
  }
  return null;
}
