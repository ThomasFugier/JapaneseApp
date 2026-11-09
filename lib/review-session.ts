import { dueCards, practiceCards } from './engine';
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

export function rewindReviewSession(session: ReviewSession): ReviewSession {
  const previous = session.answers.at(-1);
  return previous ? { ...session, index: previous.index, revealed: true, practice: previous.reviewId === null, answers: session.answers.slice(0, -1) } : session;
}
