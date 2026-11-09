import { canonical, validateSnapshot, type Deck, type Note, type StudyCard, type Snapshot, type Review, type ReviewUndo } from './model';

export type Entity = Deck | Note | StudyCard;
export type Conflict = { collection: 'decks' | 'notes' | 'cards'; id: string; local: Entity; remote: Entity };

export function mergeSnapshots(base: Snapshot, local: Snapshot, remote: Snapshot): { snapshot: Snapshot; conflicts: Conflict[] } {
  const conflicts: Conflict[] = [];
  const identities = new Map<string, StudyCard>();
  for (const card of [...base.cards, ...local.cards, ...remote.cards]) {
    const previous = identities.get(card.id);
    if (previous && (previous.noteId !== card.noteId || previous.direction !== card.direction)) {
      throw new Error('Un identifiant de carte a été réutilisé pour une autre fiche ou un autre sens. Import annulé.');
    }
    identities.set(card.id, card);
  }
  const merge = <T extends Entity>(collection: Conflict['collection'], baseline: T[], ours: T[], theirs: T[]): T[] => {
    const b = new Map(baseline.map((x) => [x.id, x]));
    const l = new Map(ours.map((x) => [x.id, x]));
    const r = new Map(theirs.map((x) => [x.id, x]));
    return [...new Set([...b.keys(), ...l.keys(), ...r.keys()])].sort().map((id) => {
      const original = b.get(id);
      // Removing an entity must use deletedAt; an absent record never silently erases data.
      const ours = l.get(id) ?? original;
      const theirs = r.get(id) ?? original;
      if (!ours) return theirs!;
      if (!theirs) return ours;
      if (canonical(ours) === canonical(theirs)) return ours;
      if (canonical(ours) === canonical(original)) return theirs;
      if (canonical(theirs) === canonical(original)) return ours;
      conflicts.push({ collection, id, local: ours, remote: theirs });
      return ours;
    });
  };
  const reviews = new Map<string, Review>();
  for (const review of [...base.reviews, ...remote.reviews, ...local.reviews]) {
    const previous = reviews.get(review.id);
    if (previous && canonical(previous) !== canonical(review)) throw new Error('Deux révisions différentes utilisent le même identifiant. Import annulé.');
    reviews.set(review.id, review);
  }
  const reviewUndos = new Map<string, ReviewUndo>();
  for (const undo of [...(base.reviewUndos ?? []), ...(remote.reviewUndos ?? []), ...(local.reviewUndos ?? [])]) {
    const previous = reviewUndos.get(undo.id);
    if (previous && canonical(previous) !== canonical(undo)) throw new Error('Deux annulations différentes utilisent le même identifiant. Import annulé.');
    reviewUndos.set(undo.id, undo);
  }
  // Scheduler settings are immutable in V1; a future settings migration must resolve them explicitly.
  if (canonical(local.scheduler) !== canonical(remote.scheduler)) throw new Error('Les paramètres de révision diffèrent. Exportez vos données avant de continuer.');
  const snapshot: Snapshot = {
      schemaVersion: 3, scheduler: local.scheduler,
      decks: merge('decks', base.decks, local.decks, remote.decks),
      notes: merge('notes', base.notes, local.notes, remote.notes),
      cards: merge('cards', base.cards, local.cards, remote.cards),
      reviews: [...reviews.values()].sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.id.localeCompare(b.id)),
      reviewUndos: [...reviewUndos.values()].sort((a, b) => Date.parse(a.undoneAt) - Date.parse(b.undoneAt) || a.id.localeCompare(b.id)),
  };

  const reviewIds = new Set(snapshot.reviews.map((review) => review.id));
  if (snapshot.reviewUndos.some((undo) => !reviewIds.has(undo.reviewId))) throw new Error('Une annulation référence une révision introuvable.');

  // A note/deck restored after a deletion conflict must not silently lose its cards.
  for (const conflict of [...conflicts]) {
    if (!!conflict.local.deletedAt === !!conflict.remote.deletedAt) continue;
    if (conflict.collection !== 'notes' && conflict.collection !== 'decks') continue;
    for (const card of snapshot.cards) {
      const ours = local.cards.find((c) => c.id === card.id) ?? base.cards.find((c) => c.id === card.id);
      const theirs = remote.cards.find((c) => c.id === card.id) ?? base.cards.find((c) => c.id === card.id);
      if (!ours || !theirs || canonical(ours) === canonical(theirs)) continue;
      const related = conflict.collection === 'notes' ? card.noteId === conflict.id : [...ours.deckIds, ...theirs.deckIds].includes(conflict.id);
      if (related && !conflicts.some((c) => c.collection === 'cards' && c.id === card.id)) {
        conflicts.push({ collection: 'cards', id: card.id, local: ours, remote: theirs });
      }
    }
  }
  // Independent valid edits can still form a hierarchy cycle when combined.
  if (!conflicts.length) validateSnapshot(snapshot);
  return { snapshot, conflicts };
}
