import { writingSuggestionRank } from './japanese-search';
import type { Note, Snapshot } from './model';

export type NoteDraft = Pick<Note, 'japanese' | 'reading' | 'meaning'>;
export type SimilarNote = { note: Note; rank: number; duplicate: boolean; sameWord: boolean };
const key = (value: string) => value.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLocaleLowerCase().trim();
const order = new Intl.Collator('ja', { numeric: true });

function activeNotes(data: Snapshot): Note[] {
  const ids = new Set(data.cards.filter(card => !card.deletedAt).map(card => card.noteId));
  return data.notes.filter(note => !note.deletedAt && ids.has(note.id));
}

function sameWord(note: Note, value: string): boolean {
  // Exact saved spelling or reading, including romaji/kana aliases; not a translation-only match.
  return !!value.trim() && writingSuggestionRank(note, value) <= 1;
}

function duplicate(note: Note, draft: NoteDraft): boolean {
  return !!draft.meaning.trim() && key(note.meaning) === key(draft.meaning)
    && sameWord(note, draft.japanese)
    && (!draft.reading.trim() || sameWord(note, draft.reading));
}

export function findDuplicateNote(data: Snapshot, draft: NoteDraft): Note | undefined {
  if (!draft.japanese.trim() || !draft.meaning.trim()) return undefined;
  return activeNotes(data).find(note => duplicate(note, draft));
}

/** Search the whole saved library, never only the currently selected deck. */
export function similarNotes(data: Snapshot, draft: NoteDraft, limit = 5): SimilarNote[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const queries = [...new Set([draft.japanese, draft.reading, draft.meaning].map(value => value.trim()))]
    .filter(value => Array.from(value).length >= 2 || /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value));
  if (!queries.length) return [];
  return activeNotes(data).flatMap(note => {
    const ranks = new Map(queries.map(query => [query, writingSuggestionRank(note, query)]));
    const rank = Math.min(...ranks.values());
    if (!Number.isFinite(rank)) return [];
    const wordRank = (value: string) => !value.trim() ? Infinity : ranks.get(value.trim()) ?? writingSuggestionRank(note, value);
    const japaneseRank = wordRank(draft.japanese);
    const readingRank = wordRank(draft.reading);
    const exact = !!draft.meaning.trim() && key(note.meaning) === key(draft.meaning)
      && japaneseRank <= 1 && (!draft.reading.trim() || readingRank <= 1);
    return [{ note, rank, duplicate: exact, sameWord: japaneseRank <= 1 || readingRank <= 1 }];
  }).sort((a, b) => Number(b.duplicate) - Number(a.duplicate) || a.rank - b.rank
    || order.compare(a.note.reading || a.note.japanese, b.note.reading || b.note.japanese)
    || a.note.id.localeCompare(b.note.id))
    .slice(0, Math.min(8, Math.floor(limit)));
}
