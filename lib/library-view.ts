import { cardsForDeck } from './engine';
import { noteSearchRank } from './japanese-search';
import type { Deck, Note, Snapshot } from './model';

export type ReadingContext = {
  deckId: string | null;
  search: string;
  sort: 'japanese' | 'meaning' | 'added';
  hideTranslations: boolean;
  expanded: string | null;
  scrollY: number;
};

export const defaultReadingContext: ReadingContext = {
  deckId: null, search: '', sort: 'japanese',
  hideTranslations: false, expanded: null, scrollY: 0,
};

export function sanitizeReadingContext(input: unknown): ReadingContext {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const id = (item: unknown) => typeof item === 'string' && item.length > 0 && item.length <= 160 ? item : null;
  return {
    deckId: id(value.deckId),
    search: typeof value.search === 'string' ? value.search.slice(0, 1000) : '',
    sort: value.sort === 'meaning' || value.sort === 'added' ? value.sort : 'japanese',
    hideTranslations: value.hideTranslations === true,
    expanded: id(value.expanded),
    scrollY: typeof value.scrollY === 'number' && Number.isFinite(value.scrollY) ? Math.max(0, Math.min(value.scrollY, 10000000)) : 0,
  };
}

export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export function deckAncestors(data: Snapshot, deckId: string): Deck[] {
  const decks = new Map(data.decks.map(deck => [deck.id, deck]));
  const result: Deck[] = [];
  const seen = new Set<string>();
  let current: string | null = deckId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const deck = decks.get(current);
    if (!deck) break;
    if (!deck.deletedAt) result.unshift(deck);
    current = deck.parentId;
  }
  return result;
}

export function noteDecks(data: Snapshot, noteId: string): Deck[] {
  const ids = new Set(cardsForDeck(data, null).filter(card => card.noteId === noteId).flatMap(card => card.deckIds));
  return data.decks.filter(deck => !deck.deletedAt && ids.has(deck.id))
    .sort((a, b) => deckAncestors(data, a.id).map(deck => deck.name).join('/').localeCompare(deckAncestors(data, b.id).map(deck => deck.name).join('/'), 'en') || a.id.localeCompare(b.id));
}

export function libraryNotes(data: Snapshot, context: ReadingContext): Note[] {
  const ids = new Set(cardsForDeck(data, context.deckId).map(card => card.noteId));
  const japanese = new Intl.Collator('ja', { numeric: true });
  const english = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  return data.notes.filter(note => !note.deletedAt && ids.has(note.id))
    .map(note => ({ note, rank: noteSearchRank(note, context.search) }))
    .filter(item => Number.isFinite(item.rank))
    .sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    const a = left.note, b = right.note;
    let order: number;
    if (context.sort === 'meaning') order = english.compare(a.meaning, b.meaning);
    else if (context.sort === 'added') {
      const left = a as Note & { createdAt?: string };
      const right = b as Note & { createdAt?: string };
      order = Date.parse(right.createdAt ?? right.updatedAt) - Date.parse(left.createdAt ?? left.updatedAt);
    } else order = japanese.compare(a.reading || a.japanese, b.reading || b.japanese) || japanese.compare(a.japanese, b.japanese);
    return order || a.id.localeCompare(b.id);
  }).map(item => item.note);
}
