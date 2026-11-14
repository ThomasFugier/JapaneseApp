import { bulkLibraryAction } from './library-actions';
import { validateSnapshot, type Snapshot } from './model';

export type ReviewDeletion = { noteId: string; cardIds: string[]; deletedAt: string };

export function deleteReviewNote(data: Snapshot, noteId: string, now = new Date().toISOString()): { snapshot: Snapshot; undo: ReviewDeletion } {
  const note = data.notes.find(item => item.id === noteId && !item.deletedAt);
  if (!note) throw new Error('This note is no longer available.');
  const cardIds = data.cards.filter(card => card.noteId === noteId && !card.deletedAt).map(card => card.id);
  if (!cardIds.length) throw new Error('This note has no active cards.');
  return { snapshot: bulkLibraryAction(data, [noteId], { type: 'delete' }, now), undo: { noteId, cardIds, deletedAt: now } };
}

export function restoreReviewNote(data: Snapshot, undo: ReviewDeletion, now = new Date().toISOString()): Snapshot {
  const note = data.notes.find(item => item.id === undo.noteId);
  if (!note) throw new Error('The deleted note is no longer available.');
  if (note.deletedAt && note.deletedAt !== undo.deletedAt) throw new Error('This note was deleted again; the old deletion cannot be undone.');

  const capturedCards = undo.cardIds.map(id => {
    const card = data.cards.find(item => item.id === id);
    if (!card || card.noteId !== undo.noteId) throw new Error('A deleted card is no longer available.');
    if (card.deletedAt && card.deletedAt !== undo.deletedAt) throw new Error('A card was deleted again; the old deletion cannot be undone.');
    return card;
  });
  const cardIds = new Set(capturedCards.map(card => card.id));
  return validateSnapshot({
    ...data,
    notes: data.notes.map(item => item.id !== undo.noteId || !item.deletedAt ? item : withoutDeletedAt(item, now)),
    cards: data.cards.map(card => !cardIds.has(card.id) || !card.deletedAt ? card : withoutDeletedAt(card, now)),
  });
}

function withoutDeletedAt<T extends { deletedAt?: string | null; updatedAt: string }>(item: T, now: string): T {
  const restored = { ...item, updatedAt: now };
  delete restored.deletedAt;
  return restored;
}
