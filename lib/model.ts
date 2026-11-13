import { z } from 'zod';
import { migrateSampleLanguage } from './sample-content';
import { DEFAULT_REVIEW_SETTINGS, reviewSettingsSchema } from './review-settings';

const id = z.string().min(1).max(160);
const date = z.iso.datetime({ offset: true });
const deletedAt = date.nullish();
const deckSchema = z.object({
  id, name: z.string().trim().min(1).max(120), description: z.string().max(2000),
  parentId: id.nullable(), color: z.enum(['sage', 'amber', 'rose', 'sky']),
  updatedAt: date, deletedAt,
});
const noteSchema = z.object({
  id, japanese: z.string().trim().min(1).max(1000), reading: z.string().max(1000),
  meaning: z.string().trim().min(1).max(3000), onReadings: z.array(z.string().trim().min(1).max(120)).max(30).optional(), kunReadings: z.array(z.string().trim().min(1).max(120)).max(30).optional(), example: z.string().max(3000),
  exampleTranslation: z.string().max(3000), explanation: z.string().max(8000),
  tags: z.array(z.string().trim().min(1).max(80)).max(30), createdAt: date.optional(), updatedAt: date, deletedAt,
});
const cardSchema = z.object({
  id, noteId: id, direction: z.enum(['ja-fr', 'fr-ja']),
  deckIds: z.array(id).max(100), updatedAt: date, deletedAt,
});
const reviewSchema = z.object({
  id, cardId: id, rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  reviewedAt: date, dueAt: date.optional(),
});
const reviewUndoSchema = z.object({ id, reviewId: id, undoneAt: date });
const snapshotSchema = z.object({
  schemaVersion: z.literal(4),
  scheduler: z.object({ algorithm: z.literal('fsrs'), version: z.literal('5'), retention: z.literal(0.9) }).default({ algorithm: 'fsrs', version: '5', retention: 0.9 }),
  reviewSettings: reviewSettingsSchema,
  decks: z.array(deckSchema).max(2000), notes: z.array(noteSchema).max(20000),
  cards: z.array(cardSchema).max(40000), reviews: z.array(reviewSchema).max(200000),
  reviewUndos: z.array(reviewUndoSchema).max(200000),
});

export type Deck = z.infer<typeof deckSchema>;
export type Note = z.infer<typeof noteSchema>;
export type StudyCard = z.infer<typeof cardSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ReviewUndo = z.infer<typeof reviewUndoSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type { ReviewSettings } from './review-settings';
export const CURRENT_SCHEMA_VERSION = 4 as const;

export function emptySnapshot(): Snapshot {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, scheduler: { algorithm: 'fsrs', version: '5', retention: 0.9 }, reviewSettings: { ...DEFAULT_REVIEW_SETTINGS }, decks: [], notes: [], cards: [], reviews: [], reviewUndos: [] };
}

export function validateSnapshot(input: unknown): Snapshot {
  const version = input && typeof input === 'object' ? (input as { schemaVersion?: unknown }).schemaVersion : undefined;
  const legacy = typeof version === 'number' && [1, 2, 3].includes(version);
  const migrated = legacy ? { ...(input as Record<string, unknown>), schemaVersion: CURRENT_SCHEMA_VERSION, reviewSettings: { ...DEFAULT_REVIEW_SETTINGS }, reviewUndos: (input as { reviewUndos?: unknown }).reviewUndos ?? [] } : input;
  const result = snapshotSchema.safeParse(migrated);
  if (!result.success) {
    const settingsIssue = result.error.issues.find(issue => issue.path[0] === 'reviewSettings');
    if (settingsIssue?.message.includes('Again ≤ Hard ≤ Good ≤ Easy')) throw new Error(settingsIssue.message);
    throw new Error('Invalid backup or unsupported version.');
  }
  const data = result.data;
  for (const collection of [data.decks, data.notes, data.cards, data.reviews, data.reviewUndos]) {
    if (new Set(collection.map((item) => item.id)).size !== collection.length) throw new Error('The backup contains duplicate IDs.');
  }
  const decks = new Map(data.decks.map((d) => [d.id, d]));
  const notes = new Map(data.notes.map((n) => [n.id, n]));
  const cards = new Set(data.cards.map((c) => c.id));
  for (const deck of data.decks) {
    const seen = new Set([deck.id]);
    let parent = deck.parentId;
    while (parent) {
      if (seen.has(parent)) throw new Error('The deck hierarchy contains a cycle.');
      seen.add(parent);
      const ancestor = decks.get(parent);
      if (!ancestor) throw new Error('A parent deck is missing.');
      parent = ancestor.parentId;
    }
  }
  const activeDirections = new Set<string>();
  for (const card of data.cards) {
    if (!notes.has(card.noteId) || card.deckIds.some((d) => !decks.has(d))) throw new Error('A card references a missing note or deck.');
    if (new Set(card.deckIds).size !== card.deckIds.length) throw new Error('A card has a duplicate deck assignment.');
    if (!card.deletedAt) {
      const key = `${card.noteId}\u0000${card.direction}`;
      if (activeDirections.has(key)) throw new Error('A note has multiple active cards in the same review direction.');
      activeDirections.add(key);
    }
  }
  for (const review of data.reviews) {
    if (!cards.has(review.cardId)) throw new Error('A review references a missing card.');
    if (review.dueAt && (Date.parse(review.dueAt) <= Date.parse(review.reviewedAt) || Date.parse(review.dueAt) - Date.parse(review.reviewedAt) > 3650 * 86400000)) throw new Error('Invalid review due date.');
  }
  const reviewIds = new Set(data.reviews.map((review) => review.id));
  for (const undo of data.reviewUndos) {
    if (!reviewIds.has(undo.reviewId)) throw new Error('An undo references a missing review.');
  }
  migrateSampleLanguage(data);
  restoreReviewDirections(data);
  return data;
}

function restoreReviewDirections(data: Snapshot): void {
  const byNote = new Map<string, StudyCard[]>();
  const ids = new Set(data.cards.map((card) => card.id));
  for (const card of data.cards) {
    const records = byNote.get(card.noteId) ?? [];
    records.push(card);
    byNote.set(card.noteId, records);
  }
  // Stable ordering also makes collision fallback independent of input ordering.
  for (const note of [...data.notes].sort((a, b) => compareIds(a.id, b.id))) {
    if (note.deletedAt) continue;
    const records = byNote.get(note.id) ?? [];
    const active = records.filter((card) => !card.deletedAt);
    const available = active.length ? active : records;
    const newest = Math.max(...available.map((card) => Date.parse(card.updatedAt)));
    const latest = available.filter((card) => Date.parse(card.updatedAt) === newest)
      .sort((a, b) => compareIds(a.updatedAt, b.updatedAt) || compareIds(a.id, b.id));
    const deckIds = [...new Set(latest.flatMap((card) => card.deckIds))].sort(compareIds);
    if (deckIds.length > 100) throw new Error('A note has too many deck assignments.');
    const updatedAt = latest[0]?.updatedAt ?? note.updatedAt;
    for (const direction of ['ja-fr', 'fr-ja'] as const) {
      const existing = records.filter((card) => card.direction === direction)
        .sort((a, b) => Number(!!a.deletedAt) - Number(!!b.deletedAt)
          || Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || compareIds(a.id, b.id))[0];
      if (existing) {
        if (existing.deletedAt || existing.deckIds.length !== deckIds.length || existing.deckIds.some((id) => !deckIds.includes(id))) {
          existing.updatedAt = updatedAt;
          delete existing.deletedAt;
        }
        existing.deckIds = [...deckIds];
      } else {
        const card: StudyCard = { id: directionCardId(note.id, direction, ids), noteId: note.id, direction, deckIds: [...deckIds], updatedAt };
        ids.add(card.id);
        data.cards.push(card);
      }
    }
  }
  if (data.cards.length > 40000) throw new Error('The backup contains too many cards.');
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function directionCardId(noteId: string, direction: StudyCard['direction'], ids: Set<string>): string {
  let base = `card-${noteId}-${direction}`;
  if (base.length > 160) {
    // FNV-1a keeps long note IDs bounded without relying on time or device state.
    let hash = 14695981039346656037n;
    for (let i = 0; i < noteId.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(noteId.charCodeAt(i))) * 1099511628211n);
    base = `card-${hash.toString(16).padStart(16, '0')}-${direction}`;
  }
  let candidate = base;
  for (let index = 2; ids.has(candidate); index++) {
    const suffix = `-${index}`;
    candidate = `${base.slice(0, 160 - suffix.length)}${suffix}`;
  }
  return candidate;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return `{${Object.keys(item).filter((key) => item[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(item[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function snapshotsEqual(left: Snapshot, right: Snapshot): boolean {
  return canonical(left) === canonical(right);
}
