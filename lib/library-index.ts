import type { Deck, Snapshot } from './model';

export type LibraryIndex = {
  noteIds: ReadonlySet<string>;
  memberships: ReadonlyMap<string, readonly Deck[]>;
  paths: ReadonlyMap<string, string>;
};

/** Build reusable active-card and deck-membership lookups for one snapshot. */
export function buildLibraryIndex(data: Snapshot): LibraryIndex {
  const activeNotes = new Set(data.notes.filter(note => !note.deletedAt).map(note => note.id));
  const decksById = new Map(data.decks.map(deck => [deck.id, deck]));
  const activeDecks = new Map([...decksById].filter(([, deck]) => !deck.deletedAt));
  const noteIds = new Set<string>();
  const membershipIds = new Map<string, Set<string>>();

  for (const card of data.cards) {
    if (card.deletedAt || !activeNotes.has(card.noteId)) continue;
    // cardsForDeck(data, null) includes active cards even when they have no decks.
    noteIds.add(card.noteId);
    let ids = membershipIds.get(card.noteId);
    if (!ids) membershipIds.set(card.noteId, ids = new Set());
    for (const deckId of card.deckIds) if (activeDecks.has(deckId)) ids.add(deckId);
  }

  const paths = new Map<string, string>();
  const pathFor = (deckId: string): string => {
    const names: string[] = [];
    const seen = new Set<string>();
    let current: string | null = deckId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const deck = decksById.get(current);
      if (!deck) break;
      if (!deck.deletedAt) names.unshift(deck.name);
      current = deck.parentId;
    }
    return names.join('/');
  };
  for (const id of activeDecks.keys()) paths.set(id, pathFor(id));

  const english = new Intl.Collator('en');
  const memberships = new Map<string, readonly Deck[]>();
  for (const noteId of activeNotes) {
    const decks = [...(membershipIds.get(noteId) ?? [])]
      .flatMap(id => activeDecks.has(id) ? [activeDecks.get(id)!] : [])
      .sort((a, b) => english.compare(paths.get(a.id)!, paths.get(b.id)!) || a.id.localeCompare(b.id));
    memberships.set(noteId, decks);
  }

  return { noteIds, memberships, paths };
}
