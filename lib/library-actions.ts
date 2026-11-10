import { validateSnapshot, type Snapshot } from './model';
import { appendTag } from './tags';

export type LibraryAction =
  | { type: 'add-tags'; tags: string[] }
  | { type: 'add-deck'; deckId: string }
  | { type: 'remove-deck'; deckId: string }
  | { type: 'delete' };

export function bulkLibraryAction(data: Snapshot, noteIds: string[], action: LibraryAction, now = new Date().toISOString()): Snapshot {
  const uniqueIds = [...new Set(noteIds)];
  const selected = new Set(uniqueIds);
  for (const id of uniqueIds) {
    if (!data.notes.some(note => note.id === id && !note.deletedAt)) throw new Error('A selected note is no longer available.');
  }
  if (action.type === 'add-deck' || action.type === 'remove-deck') {
    const deck = data.decks.find(item => item.id === action.deckId && !item.deletedAt);
    if (!deck) throw new Error('This deck is no longer available.');
  }

  const availableTags = data.notes.filter(note => !note.deletedAt).flatMap(note => note.tags);
  const notes = data.notes.map(note => {
    if (!selected.has(note.id)) return note;
    if (action.type === 'delete') return { ...note, deletedAt: now, updatedAt: now };
    if (action.type === 'add-tags') {
      const tags = action.tags.reduce((current, tag) => appendTag(current, tag, availableTags), note.tags);
      return tags.length === note.tags.length && tags.every((tag, i) => tag === note.tags[i]) ? note : { ...note, tags, updatedAt: now };
    }
    return note;
  });
  const cards = data.cards.map(card => {
    if (!selected.has(card.noteId) || card.deletedAt) return card;
    if (action.type === 'delete') return { ...card, deletedAt: now, updatedAt: now };
    if (action.type === 'add-deck' && !card.deckIds.includes(action.deckId)) return { ...card, deckIds: [...card.deckIds, action.deckId], updatedAt: now };
    if (action.type === 'remove-deck' && card.deckIds.includes(action.deckId)) return { ...card, deckIds: card.deckIds.filter(id => id !== action.deckId), updatedAt: now };
    return card;
  });
  return validateSnapshot({ ...data, notes, cards });
}

export function moveLibraryDeck(data: Snapshot, deckId: string, parentId: string | null, now = new Date().toISOString()): Snapshot {
  const deck = data.decks.find(item => item.id === deckId && !item.deletedAt);
  if (!deck) throw new Error('This deck is no longer available.');
  if (parentId !== null && !data.decks.some(item => item.id === parentId && !item.deletedAt)) throw new Error('The parent deck is no longer available.');
  if (parentId === deckId) throw new Error('A deck cannot be moved into itself.');
  if (parentId !== null) {
    const byId = new Map(data.decks.map(item => [item.id, item]));
    const seen = new Set<string>();
    let cursor: string | null = parentId;
    while (cursor !== null) {
      if (cursor === deckId) throw new Error('A deck cannot be moved into its descendant.');
      if (seen.has(cursor)) throw new Error('The deck hierarchy contains a cycle.');
      seen.add(cursor);
      const ancestor = byId.get(cursor);
      if (!ancestor) throw new Error('A parent deck is missing.');
      cursor = ancestor.parentId;
    }
  }
  if (deck.parentId === parentId) return validateSnapshot(data);
  return validateSnapshot({ ...data, decks: data.decks.map(item => item.id === deckId ? { ...item, parentId, updatedAt: now } : item) });
}
