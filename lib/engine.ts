import { createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs';
import type { Snapshot, StudyCard, Review } from './model';

export function descendants(data: Snapshot, deckId: string): string[] {
  const ids = new Set<string>();
  const visit = (id: string) => {
    if (ids.has(id)) return;
    const deck = data.decks.find((d) => d.id === id);
    if (!deck || deck.deletedAt) return;
    ids.add(id);
    data.decks.filter((d) => d.parentId === id && !d.deletedAt).forEach((d) => visit(d.id));
  };
  visit(deckId);
  return [...ids];
}

export function cardsForDeck(data: Snapshot, deckId: string | null): StudyCard[] {
  const activeDecks = new Set(data.decks.filter((d) => !d.deletedAt).map((d) => d.id));
  const selected = deckId ? new Set(descendants(data, deckId)) : activeDecks;
  const notes = new Set(data.notes.filter((n) => !n.deletedAt).map((n) => n.id));
  return data.cards.filter((c) => !c.deletedAt && notes.has(c.noteId) && (deckId === null || c.deckIds.some((d) => selected.has(d) && activeDecks.has(d))));
}

export function effectiveReviews(data: Snapshot, cardId?: string): Review[] {
  const undone = new Set((data.reviewUndos ?? []).map((undo) => undo.reviewId));
  return data.reviews.filter((review) => !undone.has(review.id) && (cardId === undefined || review.cardId === cardId))
    .sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.id.localeCompare(b.id));
}

export function scheduleForCard(data: Snapshot, cardId: string): Card {
  const reviews = effectiveReviews(data, cardId);
  const scheduler = fsrs({ request_retention: data.scheduler?.retention ?? 0.9, enable_fuzz: false });
  let card = createEmptyCard(new Date(0));
  for (const review of reviews) {
    card = scheduler.next(card, new Date(review.reviewedAt), review.rating as Grade).card;
  }
  return card;
}

export function dueCards(data: Snapshot, deckId: string | null, now = new Date()): StudyCard[] {
  return cardsForDeck(data, deckId)
    .map((card) => ({ card, due: scheduleForCard(data, card.id).due.getTime() }))
    .filter(({ due }) => due <= now.getTime())
    .sort((a, b) => a.due - b.due || a.card.id.localeCompare(b.card.id))
    .map(({ card }) => card);
}

export function reviewCounts(data: Snapshot, deckId: string | null, now = new Date()): { newCount: number; dueCount: number; total: number } {
  const due = dueCards(data, deckId, now);
  const reviewedIds = new Set(effectiveReviews(data).map((review) => review.cardId));
  const newCount = due.filter((card) => !reviewedIds.has(card.id)).length;
  return { newCount, dueCount: due.length - newCount, total: due.length };
}

export function ratingIntervals(data: Snapshot, cardId: string, now = new Date()): Record<1 | 2 | 3 | 4, string> {
  const scheduler = fsrs({ request_retention: data.scheduler?.retention ?? 0.9, enable_fuzz: false });
  const card = scheduleForCard(data, cardId);
  const format = (grade: Grade) => {
    const minutes = Math.max(1, Math.round((scheduler.next(card, now, grade).card.due.getTime() - now.getTime()) / 60000));
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
    return `${Math.round(minutes / 1440)} j`;
  };
  return { 1: format(1), 2: format(2), 3: format(3), 4: format(4) };
}
