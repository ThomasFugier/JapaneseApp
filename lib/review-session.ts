import { cardsForDeck, dueCards, practiceCards } from './engine';
import type { Snapshot } from './model';

export type ReviewSession = { deckId: string | null; ids: string[]; index: number; revealed: boolean; practice: boolean; freeOnly?: boolean; answers: { reviewId: string | null; index: number }[] };

export function createReviewSession(data: Snapshot, deckId: string | null, freeOnly = false, now = new Date()): ReviewSession | null {
  const due = freeOnly ? [] : dueCards(data, deckId, now);
  const practice = !due.length;
  const queue = practice ? practiceCards(data, deckId) : due;
  return queue.length ? { deckId, ids: queue.map(card => card.id), index: 0, revealed: false, practice, freeOnly, answers: [] } : null;
}

export function advanceReviewSession(session: ReviewSession, data: Snapshot, reviewId: string | null, now = new Date()): ReviewSession {
  const index = session.index + 1;
  const completed = session.ids.slice(0, index);
  const freeOnly = session.freeOnly ?? session.practice;
  const due = freeOnly ? [] : dueCards(data, session.deckId, now, completed);
  const practice = !due.length;
  const queue = practice ? practiceCards(data, session.deckId, completed, session.practice ? session.ids.slice(index) : []) : due;
  return { ...session, ids: [...completed, ...queue.map(card => card.id)], index, revealed: false, practice, freeOnly, answers: [...session.answers, { reviewId, index: session.index }] };
}

export function continueAfterReviewDeletion(session: ReviewSession, data: Snapshot, now = new Date()): ReviewSession {
  const completed = session.ids.slice(0, session.index);
  const freeOnly = session.freeOnly ?? session.practice;
  const due = freeOnly ? [] : dueCards(data, session.deckId, now, completed);
  const practice = !due.length;
  const pending = session.practice ? session.ids.slice(session.index + 1) : [];
  const queue = practice ? practiceCards(data, session.deckId, completed, pending) : due;
  const activeIds = new Set(cardsForDeck(data, null).map(card => card.id));
  const answers = session.answers.filter(answer => activeIds.has(session.ids[answer.index]));
  return { ...session, ids: [...completed, ...queue.map(card => card.id)], index: completed.length, revealed: false, practice, freeOnly, answers };
}

export function rewindReviewSession(session: ReviewSession): ReviewSession {
  const previous = session.answers.at(-1);
  return previous ? { ...session, index: previous.index, revealed: true, practice: previous.reviewId === null, answers: session.answers.slice(0, -1) } : session;
}
