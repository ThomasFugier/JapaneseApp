import { lessons, type LessonId } from './lessons';
import { validateSnapshot, type LessonProgress, type Snapshot } from './model';

export function mergeLessonProgress(...collections: (LessonProgress[] | undefined)[]): LessonProgress[] {
  const merged = new Map<string, LessonProgress>();
  for (const record of collections.flatMap(collection => collection ?? [])) {
    const previous = merged.get(record.id);
    if (!previous) { merged.set(record.id, record); continue; }
    const recordTime = Date.parse(record.updatedAt), previousTime = Date.parse(previous.updatedAt);
    const latestReview = [previous.lastReviewedAt, record.lastReviewedAt].filter((value): value is string => !!value).sort((a, b) => Date.parse(b) - Date.parse(a) || b.localeCompare(a))[0];
    let winner = previous;
    if (recordTime > previousTime || (recordTime === previousTime && (
      (!record.validated && previous.validated) ||
      (record.validated === previous.validated && record.updatedAt > previous.updatedAt)
    ))) winner = record;
    merged.set(record.id, latestReview ? { ...winner, lastReviewedAt: latestReview } : winner);
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function setLessonValidated(snapshot: Snapshot, id: LessonId, validated: boolean, now = new Date().toISOString()): Snapshot {
  const existing = snapshot.lessonProgress?.find(record => record.id === id);
  const updatedAt = existing && Date.parse(now) <= Date.parse(existing.updatedAt)
    ? new Date(Date.parse(existing.updatedAt) + 1).toISOString()
    : now;
  const progress = (snapshot.lessonProgress ?? []).filter(record => record.id !== id);
  progress.push({ ...existing, id, validated, updatedAt });
  return validateSnapshot({ ...snapshot, lessonProgress: progress });
}

export function validatedLessonIds(snapshot: Snapshot): LessonId[] {
  const known = new Set<string>(lessons.map(lesson => lesson.id));
  return (snapshot.lessonProgress ?? []).filter(record => record.validated && known.has(record.id)).map(record => record.id as LessonId);
}

// Reviewing and checking off a lesson are independent actions and merge independently.
export function markLessonReviewed(snapshot: Snapshot, id: LessonId, now = new Date().toISOString()): Snapshot {
  const existing = snapshot.lessonProgress?.find(record => record.id === id);
  const lastReviewedAt = existing?.lastReviewedAt && Date.parse(existing.lastReviewedAt) >= Date.parse(now) ? existing.lastReviewedAt : now;
  const record: LessonProgress = { id, validated: false, updatedAt: '1970-01-01T00:00:00.000Z', ...existing, lastReviewedAt };
  return validateSnapshot({ ...snapshot, lessonProgress: [...(snapshot.lessonProgress ?? []).filter(item => item.id !== id), record] });
}

export function lessonReviewOrder(progress: LessonProgress[] = []): LessonId[] {
  const dates = new Map(progress.map(item => [item.id, item.lastReviewedAt]));
  return lessons.map(item => item.id).sort((a, b) => {
    const first = dates.get(a), second = dates.get(b);
    if (!first || !second) return first ? 1 : second ? -1 : 0;
    return Date.parse(first) - Date.parse(second);
  });
}
