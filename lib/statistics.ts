import { fsrs, State } from 'ts-fsrs';
import { cardsForDeck, effectiveReviews, replayReviewHistory } from './engine';
import type { Note, Review, Snapshot, StudyCard } from './model';

export type DirectionStatistics = {
  cardId: string;
  direction: StudyCard['direction'];
  reviewCount: number;
  againCount: number;
  lastRating: 1 | 2 | 3 | 4 | null;
  lastReviewedAt: string | null;
  nextDueAt: string | null;
  recall: number | null;
  state: 'new' | 'learning' | 'review' | 'relearning';
  lapses: number;
};

export type CardStatistics = {
  note: Note;
  directions: DirectionStatistics[];
  reviewCount: number;
  againCount: number;
  lastReviewedAt: string | null;
  nextDueAt: string | null;
  recall: number | null;
  due: boolean;
  weak: boolean;
  studiedDirections: number;
  history: Review[];
};

export type Statistics = {
  cards: CardStatistics[];
  totalCards: number;
  studiedCards: number;
  newCards: number;
  oneDirectionCards: number;
  bothDirectionCards: number;
  dueCards: number;
  estimatedRecall: number | null;
  periodReviews: number;
  periodActiveDays: number;
  ratings: Record<1 | 2 | 3 | 4, number>;
  activity: { date: string; count: number }[];
};

function localDateKey(date: Date): string {
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

export function buildStatistics(data: Snapshot, now = new Date(), deckId: string | null = null, periodDays = 30): Statistics {
  const scopedCards = cardsForDeck(data, deckId).sort((a, b) => a.id.localeCompare(b.id));
  const cardsById = new Map(scopedCards.map(card => [card.id, card]));
  const histories = new Map<string, Review[]>();
  const noteHistories = new Map<string, Review[]>();
  const nowTime = now.getTime();
  const reviews = effectiveReviews(data).filter(review => cardsById.has(review.cardId) && Date.parse(review.reviewedAt) <= nowTime);
  for (const review of reviews) {
    const history = histories.get(review.cardId) ?? [];
    history.push(review);
    histories.set(review.cardId, history);
    const noteId = cardsById.get(review.cardId)!.noteId;
    const noteHistory = noteHistories.get(noteId) ?? [];
    noteHistory.push(review);
    noteHistories.set(noteId, noteHistory);
  }

  const scheduler = fsrs({ request_retention: data.scheduler?.retention ?? 0.9, enable_fuzz: false });
  const directionsByNote = new Map<string, DirectionStatistics[]>();
  let recallSum = 0, recallCount = 0;
  for (const card of scopedCards) {
    const history = histories.get(card.id) ?? [];
    const schedule = replayReviewHistory(history, scheduler);
    const studied = history.length > 0 && schedule.reps > 0;
    const recall = studied ? scheduler.get_retrievability(schedule, now, false) : null;
    if (recall !== null) {
      recallSum += recall;
      recallCount++;
    }
    const direction: DirectionStatistics = {
      cardId: card.id,
      direction: card.direction,
      reviewCount: history.length,
      againCount: history.filter(review => review.rating === 1).length,
      lastRating: history.at(-1)?.rating ?? null,
      lastReviewedAt: history.at(-1)?.reviewedAt ?? null,
      nextDueAt: studied ? schedule.due.toISOString() : null,
      recall,
      state: schedule.state === State.Learning ? 'learning' : schedule.state === State.Review ? 'review' : schedule.state === State.Relearning ? 'relearning' : 'new',
      lapses: schedule.lapses,
    };
    const directions = directionsByNote.get(card.noteId) ?? [];
    directions.push(direction);
    directionsByNote.set(card.noteId, directions);
  }

  const cards: CardStatistics[] = data.notes.filter(note => directionsByNote.has(note.id)).map(note => {
    const directions = directionsByNote.get(note.id)!.sort((a, b) => Number(a.direction === 'fr-ja') - Number(b.direction === 'fr-ja') || a.cardId.localeCompare(b.cardId));
    const studied = directions.filter(direction => direction.recall !== null);
    const history = noteHistories.get(note.id) ?? [];
    const nextDueAt = studied.map(direction => direction.nextDueAt!).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
    return {
      note,
      directions,
      reviewCount: history.length,
      againCount: directions.reduce((sum, direction) => sum + direction.againCount, 0),
      lastReviewedAt: history.at(-1)?.reviewedAt ?? null,
      nextDueAt,
      recall: studied.length ? Math.min(...studied.map(direction => direction.recall!)) : null,
      due: nextDueAt !== null && Date.parse(nextDueAt) <= nowTime,
      weak: studied.some(direction => direction.recall! < 0.8 || direction.lastRating === 1 || direction.state === 'relearning'),
      studiedDirections: studied.length,
      history: history.slice(-12).reverse(),
    };
  }).sort((a, b) => a.note.id.localeCompare(b.note.id));

  const days = Number.isFinite(periodDays) ? Math.max(1, Math.trunc(periodDays)) : 30;
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  firstDay.setDate(firstDay.getDate() - days + 1);
  const activity: Statistics['activity'] = [];
  const buckets = new Map<string, { date: string; count: number }>();
  const day = new Date(firstDay);
  for (let index = 0; index < days; index++) {
    const bucket = { date: localDateKey(day), count: 0 };
    activity.push(bucket);
    buckets.set(bucket.date, bucket);
    day.setDate(day.getDate() + 1);
  }
  const ratings: Statistics['ratings'] = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let periodReviews = 0;
  for (const review of reviews) {
    const reviewedAt = new Date(review.reviewedAt);
    if (reviewedAt.getTime() < firstDay.getTime()) continue;
    const bucket = buckets.get(localDateKey(reviewedAt));
    if (!bucket) continue;
    bucket.count++;
    ratings[review.rating]++;
    periodReviews++;
  }
  const oneDirectionCards = cards.filter(card => card.studiedDirections === 1).length;
  const bothDirectionCards = cards.filter(card => card.studiedDirections === 2).length;
  return {
    cards,
    totalCards: cards.length,
    studiedCards: oneDirectionCards + bothDirectionCards,
    newCards: cards.filter(card => card.studiedDirections === 0).length,
    oneDirectionCards,
    bothDirectionCards,
    dueCards: cards.filter(card => card.due).length,
    estimatedRecall: recallCount ? recallSum / recallCount : null,
    periodReviews,
    periodActiveDays: activity.filter(bucket => bucket.count > 0).length,
    ratings,
    activity,
  };
}
