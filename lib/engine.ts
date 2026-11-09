import { createEmptyCard, fsrs, State, type Card, type Grade } from 'ts-fsrs';
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
  const scheduler = fsrs({ request_retention: data.scheduler?.retention ?? 0.9, enable_fuzz: false });
  return replayReviews(effectiveReviews(data, cardId), scheduler);
}

function replayReviews(reviews: Review[], scheduler: ReturnType<typeof fsrs>): Card {
  let card = createEmptyCard(new Date(0));
  for (const review of reviews) {
    card = scheduler.next(card, new Date(review.reviewedAt), review.rating as Grade).card;
  }
  return card;
}

function reviewOrder(card: StudyCard): number {
  let hash = 2166136261;
  for (let index = 0; index < card.noteId.length; index++) hash = Math.imul(hash ^ card.noteId.charCodeAt(index), 16777619);
  // Equal-due directions are mixed; opposite sides of a note stay half a queue apart.
  return (hash ^ (card.direction === 'fr-ja' ? 0x80000000 : 0)) >>> 0;
}

export function dueCards(data: Snapshot, deckId: string | null, now = new Date(), recentCardIds: string[] = []): StudyCard[] {
  const scheduler = fsrs({ request_retention: data.scheduler?.retention ?? 0.9, enable_fuzz: false });
  const histories = new Map<string, Review[]>();
  for (const review of effectiveReviews(data)) {
    const history = histories.get(review.cardId) ?? [];
    history.push(review); histories.set(review.cardId, history);
  }
  const ranked = cardsForDeck(data, deckId)
    .map((card) => {
      const schedule = replayReviews(histories.get(card.id) ?? [], scheduler);
      const phase = !schedule.reps ? 0 : schedule.state === State.Learning || schedule.state === State.Relearning ? 1 : 2;
      return { card, due: schedule.due.getTime(), phase, recall: phase === 2 ? scheduler.get_retrievability(schedule, now, false) : 0, order: reviewOrder(card) };
    })
    .filter(({ due }) => due <= now.getTime())
    // Unseen cards always come first, followed by due learning steps and weak due memories.
    .sort((a, b) => a.phase - b.phase || a.recall - b.recall || a.due - b.due || a.order - b.order || a.card.id.localeCompare(b.card.id));
  const queue = ranked.map(({ card }) => card);
  const allowed = new Set(ranked.filter(item => item.phase === ranked[0]?.phase).map(item => item.card.id));
  return spaceRecentWords(data, queue, recentCardIds, allowed);
}

export function practiceCards(data: Snapshot, deckId: string | null, recentCardIds: string[] = [], pendingIds: string[] = []): StudyCard[] {
  const active = cardsForDeck(data, deckId), byId = new Map(active.map(card => [card.id, card]));
  const pending = [...new Set(pendingIds)].flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const queue = pending.length ? pending : active.sort((a, b) => reviewOrder(a) - reviewOrder(b) || a.id.localeCompare(b.id));
  return spaceRecentWords(data, queue, recentCardIds);
}

function spaceRecentWords(data: Snapshot, queue: StudyCard[], recentCardIds: string[], allowed?: Set<string>): StudyCard[] {
  // Space recent words without promoting a lower-priority graded review.
  if (recentCardIds.length && queue.length > 1) {
    const noteIds = new Map(data.cards.map(card => [card.id, card.noteId]));
    for (let gap = Math.min(3, recentCardIds.length); gap > 0; gap--) {
      const recent = new Set(recentCardIds.slice(-gap).map(id => noteIds.get(id)));
      const index = queue.findIndex(card => (!allowed || allowed.has(card.id)) && !recent.has(card.noteId));
      if (index >= 0) {
        if (index > 0) queue.unshift(queue.splice(index, 1)[0]);
        break;
      }
    }
  }
  return queue;
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
    return `${Math.round(minutes / 1440)} d`;
  };
  return { 1: format(1), 2: format(2), 3: format(3), 4: format(4) };
}
