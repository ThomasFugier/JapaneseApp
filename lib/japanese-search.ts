import { toHiragana, toRomaji } from 'wanakana';
import { cardsForDeck } from './engine';
import type { Note, Snapshot } from './model';

type SearchableNote = Note & { onReadings?: string[]; kunReadings?: string[] };

/** Normalize Latin accents without removing Japanese dakuten. */
function textKey(value: string): string {
  return value.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLocaleLowerCase().trim();
}

function readingKey(value: string): string {
  // Dots mark the okurigana boundary in readings such as た.べる.
  return textKey(value).replace(/[.．\-‐‑–—]/g, '');
}

function phoneticAliases(value: string): string[] {
  const original = readingKey(value);
  if (!original) return [];
  const kana = toHiragana(original);
  return [...new Set([original, kana, textKey(toRomaji(kana))])].filter(Boolean);
}

function savedReadings(note: SearchableNote): string[] {
  return [note.reading, ...(note.onReadings ?? []), ...(note.kunReadings ?? [])]
    .flatMap(reading => reading.split(/[、,，;；/／・\s()[\]（）]+/)).filter(Boolean);
}

export function noteSearchRank(note: SearchableNote, query: string): number {
  const key = textKey(query);
  if (!key) return 0;
  const rank = suggestionRank(note, key);
  if (rank < 100) return rank;
  const text = textKey([
    note.japanese, note.reading, note.meaning, note.example, note.exampleTranslation,
    note.explanation, ...note.tags, ...(note.onReadings ?? []), ...(note.kunReadings ?? []),
  ].join(' '));
  if (text.includes(key)) return 30;
  return rank;
}

export function matchesNote(note: SearchableNote, query: string): boolean {
  return Number.isFinite(noteSearchRank(note, query));
}

/** Adjacent swaps count as one typo, like a missing, extra or replaced letter. */
function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let beforePrevious = previous;
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        current[j] = Math.min(current[j], beforePrevious[j - 2] + 1);
      }
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[right.length];
}

function fuzzyRank(fields: string[], queries: string[]): number {
  // Compare romaji rather than kana: one changed mora can hide several letters.
  // Short queries keep their exact/prefix behavior; unrelated terms stay hidden.
  const terms = [...new Set(fields)].filter(value => /^[a-z0-9]{4,80}$/.test(value));
  let best = Infinity;
  for (const query of new Set(queries)) {
    if (!/^[a-z0-9]{4,80}$/.test(query)) continue;
    const maximum = query.length >= 8 ? 2 : 1;
    for (const term of terms) {
      if (Math.abs(term.length - query.length) > maximum) continue;
      const distance = editDistance(query, term);
      if (distance <= maximum) best = Math.min(best, 100 + distance + distance / Math.max(query.length, term.length));
    }
  }
  return best;
}

function suggestionRank(note: SearchableNote, query: string): number {
  const queries = phoneticAliases(query);
  const japanese = phoneticAliases(note.japanese);
  const readings = [...new Set(savedReadings(note).flatMap(phoneticAliases))];
  const meaning = textKey(note.meaning);
  let best = Infinity;
  const compare = (fields: string[], queryValues: string[], priority: number) => {
    for (const field of fields) for (const value of queryValues) {
      if (field === value) best = Math.min(best, priority);
      else if (field.startsWith(value)) best = Math.min(best, 10 + priority);
      else if (field.includes(value)) best = Math.min(best, 20 + priority);
    }
  };
  compare(japanese, queries, 0);
  compare(readings, queries, 1);
  compare([meaning], [textKey(query)], 2);
  return Number.isFinite(best) ? best : fuzzyRank([...japanese, ...readings, meaning, ...meaning.split(/\s+/)], queries);
}

/** Autocomplete uses saved entries only, never an external Japanese dictionary. */
export function writingSuggestions(data: Snapshot, query: string, limit = 8): Note[] {
  const key = textKey(query);
  if (!key || !Number.isFinite(limit) || limit <= 0) return [];
  const ids = new Set(cardsForDeck(data, null).map(card => card.noteId));
  const collator = new Intl.Collator('ja');
  return data.notes.filter(note => !note.deletedAt && ids.has(note.id))
    .map(note => ({ note, rank: suggestionRank(note, key) }))
    .filter(item => Number.isFinite(item.rank))
    .sort((a, b) => a.rank - b.rank
      || collator.compare(a.note.reading || a.note.japanese, b.note.reading || b.note.japanese)
      || collator.compare(a.note.japanese, b.note.japanese)
      || a.note.id.localeCompare(b.note.id))
    .slice(0, Math.min(50, Math.floor(limit)))
    .map(item => item.note);
}
