import { z } from 'zod';

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
  reviewedAt: date,
});
const reviewUndoSchema = z.object({ id, reviewId: id, undoneAt: date });
const snapshotSchema = z.object({
  schemaVersion: z.literal(3),
  scheduler: z.object({ algorithm: z.literal('fsrs'), version: z.literal('5'), retention: z.literal(0.9) }).default({ algorithm: 'fsrs', version: '5', retention: 0.9 }),
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

export function emptySnapshot(): Snapshot {
  return { schemaVersion: 3, scheduler: { algorithm: 'fsrs', version: '5', retention: 0.9 }, decks: [], notes: [], cards: [], reviews: [], reviewUndos: [] };
}

export function validateSnapshot(input: unknown): Snapshot {
  const legacy = input && typeof input === 'object' && [1, 2].includes((input as { schemaVersion?: unknown }).schemaVersion as number);
  const migrated = legacy ? { ...(input as Record<string, unknown>), schemaVersion: 3, reviewUndos: (input as { reviewUndos?: unknown }).reviewUndos ?? [] } : input;
  const result = snapshotSchema.safeParse(migrated);
  if (!result.success) throw new Error('Sauvegarde invalide ou version non prise en charge.');
  const data = result.data;
  for (const collection of [data.decks, data.notes, data.cards, data.reviews, data.reviewUndos]) {
    if (new Set(collection.map((item) => item.id)).size !== collection.length) throw new Error('La sauvegarde contient des identifiants en double.');
  }
  const decks = new Map(data.decks.map((d) => [d.id, d]));
  const notes = new Map(data.notes.map((n) => [n.id, n]));
  const cards = new Set(data.cards.map((c) => c.id));
  for (const deck of data.decks) {
    const seen = new Set([deck.id]);
    let parent = deck.parentId;
    while (parent) {
      if (seen.has(parent)) throw new Error('La hiérarchie des decks contient une boucle.');
      seen.add(parent);
      const ancestor = decks.get(parent);
      if (!ancestor) throw new Error('Un deck parent est introuvable.');
      parent = ancestor.parentId;
    }
  }
  const activeDirections = new Set<string>();
  for (const card of data.cards) {
    if (!notes.has(card.noteId) || card.deckIds.some((d) => !decks.has(d))) throw new Error('Une carte référence une fiche ou un deck introuvable.');
    if (new Set(card.deckIds).size !== card.deckIds.length) throw new Error('Un classement de carte est dupliqué.');
    if (!card.deletedAt) {
      const key = `${card.noteId}\u0000${card.direction}`;
      if (activeDirections.has(key)) throw new Error('Une fiche possède plusieurs cartes actives dans le même sens de révision.');
      activeDirections.add(key);
    }
  }
  for (const review of data.reviews) {
    if (!cards.has(review.cardId)) throw new Error('Une révision référence une carte introuvable.');
  }
  const reviewIds = new Set(data.reviews.map((review) => review.id));
  for (const undo of data.reviewUndos) {
    if (!reviewIds.has(undo.reviewId)) throw new Error('Une annulation référence une révision introuvable.');
  }
  return data;
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
