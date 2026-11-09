import test from 'node:test';
import assert from 'node:assert/strict';
import { updateNoteContent } from '../lib/note-edit';
import { seedSnapshot } from '../lib/seed';
import { dueCards, scheduleForCard } from '../lib/engine';
import { backupBytes, readBackup } from '../lib/portability';

test('editing a reviewed card preserves both schedules, identities, memberships and history', () => {
  const data = seedSnapshot();
  const original = data.notes.find(note => note.id === 'note-taberu')!;
  original.createdAt = '2026-10-01T12:00:00.000Z';
  const directions = data.cards.filter(card => card.noteId === original.id);
  const reverse = directions.find(card => card.direction === 'fr-ja')!;
  data.reviews = [
    { id: 'forward', cardId: 'card-taberu', rating: 3, reviewedAt: '2026-11-08T10:00:00.000Z' },
    { id: 'reverse', cardId: reverse.id, rating: 4, reviewedAt: '2026-11-08T10:00:00.000Z' },
    { id: 'undone', cardId: reverse.id, rating: 1, reviewedAt: '2026-11-09T10:00:00.000Z' },
  ];
  data.reviewUndos.push({ id: 'undo', reviewId: 'undone', undoneAt: '2026-11-09T10:01:00.000Z' });
  const before = structuredClone(data), now = new Date('2026-11-09T11:00:00.000Z');
  const changed = updateNoteContent(data, { ...original, japanese: '食べます', reading: 'たべます', onReadings: ['ショク'], kunReadings: ['た.べる'], meaning: 'to eat (polite)', explanation: 'Corrected note.', tags: ['verb', 'polite'], createdAt: '2026-11-09T11:00:00.000Z', updatedAt: now.toISOString() });
  assert.equal(changed.notes.find(note => note.id === original.id)!.japanese, '食べます');
  assert.equal(changed.notes.find(note => note.id === original.id)!.createdAt, original.createdAt);
  assert.deepEqual(changed.cards, data.cards);
  assert.deepEqual(changed.reviews, data.reviews);
  assert.deepEqual(changed.reviewUndos, data.reviewUndos);
  assert.deepEqual(changed.scheduler, data.scheduler);
  for (const card of directions) assert.deepEqual(scheduleForCard(changed, card.id), scheduleForCard(data, card.id));
  assert.deepEqual(dueCards(changed, null, now).map(card => card.id), dueCards(data, null, now).map(card => card.id));
  assert.deepEqual(data, before);
});

test('missing or concurrently deleted cards cannot be recreated by the quick editor', () => {
  const data = seedSnapshot(), content = { ...data.notes[0] };
  assert.throws(() => updateNoteContent(data, { ...content, id: 'missing' }), /no longer available/);
  data.notes[0].deletedAt = '2026-11-09T11:00:00.000Z';
  const before = structuredClone(data);
  assert.throws(() => updateNoteContent(data, content), /no longer available/);
  assert.deepEqual(data, before);
});

test('invalid corrections leave the card and its statistics unchanged', () => {
  const data = seedSnapshot(), before = structuredClone(data);
  assert.throws(() => updateNoteContent(data, { ...data.notes[0], japanese: '' }), /Invalid/);
  assert.deepEqual(data, before);
});

test('corrected readings and review progress survive a backup round trip', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'saved-review', cardId: data.cards[0].id, rating: 4, reviewedAt: '2026-11-08T10:00:00.000Z' });
  const changed = updateNoteContent(data, { ...data.notes[0], reading: 'たべる', explanation: 'Updated explanation.', updatedAt: '2026-11-09T11:00:00.000Z' });
  const restored = readBackup(backupBytes(changed));
  assert.deepEqual(restored, changed);
  assert.deepEqual(restored.reviews, data.reviews);
});
