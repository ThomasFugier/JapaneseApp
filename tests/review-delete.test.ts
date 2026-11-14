import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveReviews, scheduleForCard } from '../lib/engine';
import { mergeSnapshots } from '../lib/merge';
import { seedSnapshot } from '../lib/seed';
import { deleteReviewNote, restoreReviewNote } from '../lib/review-delete';
import { continueAfterReviewDeletion, type ReviewSession } from '../lib/review-session';

const deletedAt = '2026-11-12T10:00:00.000Z';
const restoredAt = '2026-11-12T10:05:00.000Z';
const noteSession = (ids: string[], index = 0, practice = false): ReviewSession => ({ deckId: null, ids, index, revealed: true, practice, freeOnly: practice, answers: [] });

test('deleting a note tombstones both active directions and preserves history', () => {
  const data = seedSnapshot(), note = data.notes[0];
  const cards = data.cards.filter(card => card.noteId === note.id && !card.deletedAt);
  data.reviews.push({ id: 'kept-review', cardId: cards[0].id, rating: 3, reviewedAt: deletedAt });
  data.reviewUndos.push({ id: 'kept-undo', reviewId: 'kept-review', undoneAt: deletedAt });
  const before = structuredClone(data);
  const result = deleteReviewNote(data, note.id, deletedAt);
  assert.deepEqual(result.undo, { noteId: note.id, cardIds: cards.map(card => card.id), deletedAt });
  assert.equal(result.snapshot.notes.find(item => item.id === note.id)!.deletedAt, deletedAt);
  assert.ok(result.undo.cardIds.every(id => result.snapshot.cards.find(card => card.id === id)!.deletedAt === deletedAt));
  assert.deepEqual(result.snapshot.reviews, before.reviews);
  assert.deepEqual(result.snapshot.reviewUndos, before.reviewUndos);
  assert.deepEqual(data, before);
});

test('restore preserves later edits, card assignments, new reviews, and older archived directions', () => {
  const data = seedSnapshot(), note = data.notes[0];
  const [forward, reverse] = data.cards.filter(card => card.noteId === note.id && !card.deletedAt);
  const oldArchive = { ...forward, id: 'old-archive', deletedAt: '2026-11-01T00:00:00.000Z' };
  data.cards.push(oldArchive);
  data.reviews.push({ id: 'before-delete', cardId: forward.id, rating: 3, reviewedAt: deletedAt });
  const reverseSchedule = scheduleForCard(data, reverse.id);
  const { snapshot: removed, undo } = deleteReviewNote(data, note.id, deletedAt);
  const removedNote = removed.notes.find(item => item.id === note.id)!;
  removedNote.meaning = 'edited while deleted';
  removedNote.tags = ['kept-tag'];
  const extraDeckId = data.decks.find(deck => !forward.deckIds.includes(deck.id))!.id;
  const editedDeckIds = [...removed.cards.find(card => card.id === forward.id)!.deckIds, extraDeckId];
  removed.cards.find(card => card.id === forward.id)!.deckIds = editedDeckIds;
  removed.reviews.push({ id: 'new-review', cardId: forward.id, rating: 4, reviewedAt: restoredAt });

  const restored = restoreReviewNote(removed, undo, restoredAt);
  const restoredNote = restored.notes.find(item => item.id === note.id)!;
  assert.equal(restoredNote.deletedAt, undefined);
  assert.equal(restoredNote.meaning, 'edited while deleted');
  assert.deepEqual(restoredNote.tags, ['kept-tag']);
  assert.equal(restoredNote.updatedAt, restoredAt);
  assert.equal(restored.cards.find(card => card.id === forward.id)!.deletedAt, undefined);
  assert.deepEqual([...restored.cards.find(card => card.id === forward.id)!.deckIds].sort(), [...editedDeckIds].sort());
  assert.equal(restored.cards.find(card => card.id === forward.id)!.updatedAt, restoredAt);
  assert.equal(restored.cards.find(card => card.id === oldArchive.id)!.deletedAt, oldArchive.deletedAt);
  assert.deepEqual(effectiveReviews(restored, forward.id).map(review => review.id), ['before-delete', 'new-review']);
  assert.deepEqual(scheduleForCard(restored, reverse.id), reverseSchedule);
});

test('stale undo cannot undo a later deletion or revive a card deleted later', () => {
  const data = seedSnapshot(), note = data.notes[0];
  const { snapshot: removed, undo } = deleteReviewNote(data, note.id, deletedAt);
  removed.notes.find(item => item.id === note.id)!.deletedAt = restoredAt;
  assert.throws(() => restoreReviewNote(removed, undo, '2026-11-12T10:10:00.000Z'), /deleted again/);

  const clean = deleteReviewNote(data, note.id, deletedAt);
  const card = clean.undo.cardIds[0];
  clean.snapshot.cards.find(item => item.id === card)!.deletedAt = restoredAt;
  assert.throws(() => restoreReviewNote(clean.snapshot, clean.undo, '2026-11-12T10:10:00.000Z'), /deleted again/);
});

test('stale device merge keeps deletion and restoration merges as fresh entity updates', () => {
  const base = seedSnapshot(), note = base.notes[0];
  const deletion = deleteReviewNote(base, note.id, deletedAt);
  const staleMerge = mergeSnapshots(base, base, deletion.snapshot);
  assert.equal(staleMerge.conflicts.length, 0);
  assert.equal(staleMerge.snapshot.notes.find(item => item.id === note.id)!.deletedAt, deletedAt);

  const restored = restoreReviewNote(deletion.snapshot, deletion.undo, restoredAt);
  const mergedRestore = mergeSnapshots(deletion.snapshot, restored, deletion.snapshot);
  assert.equal(mergedRestore.conflicts.length, 0);
  assert.equal(mergedRestore.snapshot.notes.find(item => item.id === note.id)!.deletedAt, undefined);
  assert.ok(deletion.undo.cardIds.every(id => !mergedRestore.snapshot.cards.find(card => card.id === id)!.deletedAt));
});

test('undo cannot restore another note and repeating a completed undo changes nothing', () => {
  const base = seedSnapshot(), note = base.notes[0];
  const deletion = deleteReviewNote(base, note.id, deletedAt);
  const before = structuredClone(deletion.snapshot);
  const foreign = base.cards.find(card => card.noteId !== note.id)!;
  assert.throws(() => restoreReviewNote(deletion.snapshot, { ...deletion.undo, cardIds: [foreign.id] }, restoredAt), /no longer available/);
  assert.deepEqual(deletion.snapshot, before);
  const restored = restoreReviewNote(deletion.snapshot, deletion.undo, restoredAt);
  assert.deepEqual(restoreReviewNote(restored, deletion.undo, '2026-11-12T10:10:00.000Z'), restored);
});

test('review deletion skips both directions, keeps index without adding an answer, and filters deleted answers', () => {
  const data = seedSnapshot(), note = data.notes[0];
  const pair = data.cards.filter(card => card.noteId === note.id && !card.deletedAt).map(card => card.id);
  const other = data.cards.find(card => card.noteId !== note.id && !card.deletedAt)!;
  const { snapshot } = deleteReviewNote(data, note.id, deletedAt);
  const session: ReviewSession = { ...noteSession([other.id, pair[0], pair[1]], 2), answers: [{ reviewId: 'keep', index: 0 }, { reviewId: 'old', index: 1 }] };
  const next = continueAfterReviewDeletion(session, snapshot, new Date(deletedAt));
  assert.equal(next.index, 2);
  assert.equal(next.revealed, false);
  assert.deepEqual(next.answers, [{ reviewId: 'keep', index: 0 }]);
  assert.ok(!next.ids.slice(next.index).some(id => pair.includes(id)));
  assert.equal(next.answers.length, 1);
});

test('deleting the last card ends the session; free practice continues with remaining cards', () => {
  const data = seedSnapshot(), note = data.notes[0];
  const pair = data.cards.filter(card => card.noteId === note.id && !card.deletedAt).map(card => card.id);
  const { snapshot } = deleteReviewNote(data, note.id, deletedAt);
  const onlyNote = structuredClone(snapshot);
  onlyNote.notes = onlyNote.notes.filter(item => item.id === note.id);
  onlyNote.cards = onlyNote.cards.filter(card => card.noteId === note.id);
  assert.deepEqual(continueAfterReviewDeletion(noteSession([pair[0]], 0), onlyNote, new Date(deletedAt)).ids, []);

  const practice = { ...noteSession([pair[0], pair[1], ...data.cards.filter(card => card.noteId !== note.id && !card.deletedAt).slice(0, 2).map(card => card.id)], 0, true), revealed: true };
  const next = continueAfterReviewDeletion(practice, snapshot, new Date(deletedAt));
  assert.equal(next.practice, true);
  assert.equal(next.freeOnly, true);
  assert.equal(next.index, 0);
  assert.ok(next.ids.length > 0);
  assert.ok(!next.ids.some(id => pair.includes(id)));
  assert.equal(next.answers.length, 0);
});
