import test from 'node:test';
import assert from 'node:assert/strict';
import { fsrs } from 'ts-fsrs';
import { dueCards, scheduleForCard } from '../lib/engine';
import { seedSnapshot } from '../lib/seed';

test('new reviews mix both directions without placing the same note back to back', () => {
  const data = seedSnapshot();
  const now = new Date('2026-11-09T10:00:00.000Z');
  const queue = dueCards(data, null, now);
  assert.equal(queue.length, data.notes.length * 2);
  assert.equal(new Set(queue.map(card => card.id)).size, queue.length);
  assert.equal(new Set(queue.slice(0, data.notes.length).map(card => card.direction)).size, 2);
  for (let index = 1; index < queue.length; index++) assert.notEqual(queue[index].noteId, queue[index - 1].noteId);
  assert.deepEqual(dueCards(data, null, now), queue);
});

test('unseen cards always precede due learning steps', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'queue-reviewed', cardId: data.cards[0].id, rating: 3, reviewedAt: '2026-11-09T10:00:00.000Z' });
  const queue = dueCards(data, null, new Date('2026-11-10T10:00:00.000Z'));
  assert.equal(queue.at(-1)!.id, data.cards[0].id);
  assert.ok(queue.slice(0, -1).every(card => scheduleForCard(data, card.id).reps === 0));
});

test('after unseen cards, weakest due memories precede stronger overdue memories', () => {
  const data = seedSnapshot();
  const now = new Date('2026-11-20T10:00:00.000Z');
  data.reviews = [
    { id: 'stable-1', cardId: 'card-taberu', rating: 4, reviewedAt: '2026-05-24T10:00:00.000Z' },
    { id: 'stable-2', cardId: 'card-taberu', rating: 4, reviewedAt: '2026-06-01T10:00:00.000Z' },
    { id: 'weak-1', cardId: 'card-nomu', rating: 4, reviewedAt: '2026-10-21T10:00:00.000Z' },
  ];
  const stable = scheduleForCard(data, 'card-taberu'), weak = scheduleForCard(data, 'card-nomu');
  const scheduler = fsrs({ enable_fuzz: false });
  assert.ok(stable.due < weak.due);
  assert.ok(scheduler.get_retrievability(weak, now, false) < scheduler.get_retrievability(stable, now, false));
  const queue = dueCards(data, null, now);
  assert.deepEqual(queue.slice(-2).map(card => card.id), ['card-nomu', 'card-taberu']);
  assert.ok(queue.slice(0, -2).every(card => scheduleForCard(data, card.id).reps === 0));
});

test('overdue learning steps retain their deadline order', () => {
  const data = seedSnapshot();
  data.reviews = [
    { id: 'earlier', cardId: 'card-taberu', rating: 1, reviewedAt: '2026-11-09T09:00:00.000Z' },
    { id: 'later', cardId: 'card-nomu', rating: 1, reviewedAt: '2026-11-09T09:30:00.000Z' },
  ];
  assert.deepEqual(dueCards(data, null, new Date('2026-11-09T10:00:00.000Z')).slice(-2).map(card => card.id), ['card-taberu', 'card-nomu']);
});

test('Easy keeps a direction out of the queue until its scheduled deadline', () => {
  const data = seedSnapshot();
  const now = new Date('2026-11-09T10:00:00.000Z');
  data.reviews.push({ id: 'easy', cardId: 'card-taberu', rating: 4, reviewedAt: now.toISOString() });
  const due = scheduleForCard(data, 'card-taberu').due;
  assert.ok(due.getTime() - now.getTime() > 86400000);
  assert.ok(!dueCards(data, null, new Date(due.getTime() - 1)).some(card => card.id === 'card-taberu'));
  assert.ok(dueCards(data, null, due).some(card => card.id === 'card-taberu'));
  assert.ok(dueCards(data, null, now).some(card => card.noteId === 'note-taberu' && card.direction === 'fr-ja'));
});

test('recent-word spacing adapts to a small deck without blocking eligible reviews', () => {
  const data = seedSnapshot();
  const noteIds = ['note-taberu', 'note-nomu', 'note-ringo'];
  data.notes = data.notes.filter(note => noteIds.includes(note.id));
  data.cards = data.cards.filter(card => noteIds.includes(card.noteId));
  const queue = dueCards(data, null, new Date('2026-11-09T10:00:00.000Z'), ['card-taberu', 'card-nomu', 'card-ringo']);
  assert.equal(queue[0].noteId, 'note-taberu');
  assert.equal(queue.length, 6);
  assert.equal(new Set(queue.map(card => card.id)).size, 6);
});

test('undone answers do not influence priorities and queue calculation preserves history', () => {
  const data = seedSnapshot(), now = new Date('2026-11-09T10:00:00.000Z');
  const original = dueCards(data, null, now).map(card => card.id);
  data.reviews.push({ id: 'cancelled', cardId: 'card-taberu', rating: 1, reviewedAt: '2026-11-09T09:00:00.000Z' });
  data.reviewUndos.push({ id: 'undo', reviewId: 'cancelled', undoneAt: '2026-11-09T09:01:00.000Z' });
  const before = structuredClone(data);
  assert.deepEqual(dueCards(data, null, now).map(card => card.id), original);
  assert.deepEqual(data, before);
});

test('recent-word spacing never promotes a due review ahead of an unseen direction', () => {
  const data = seedSnapshot(), now = new Date('2026-11-09T10:00:00.000Z');
  data.notes = data.notes.filter(note => ['note-taberu', 'note-nomu'].includes(note.id));
  data.cards = data.cards.filter(card => ['note-taberu', 'note-nomu'].includes(card.noteId));
  const reverse = data.cards.find(card => card.noteId === 'note-nomu' && card.direction === 'fr-ja')!;
  data.reviews = [
    { id: 'known-taberu', cardId: 'card-taberu', rating: 4, reviewedAt: '2026-11-08T10:00:00.000Z' },
    { id: 'forgotten-nomu', cardId: 'card-nomu', rating: 1, reviewedAt: '2026-11-09T09:58:00.000Z' },
    { id: 'known-nomu', cardId: reverse.id, rating: 4, reviewedAt: '2026-11-08T10:00:00.000Z' },
  ];
  const queue = dueCards(data, null, now, ['card-taberu']);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].noteId, 'note-taberu');
  assert.equal(queue[0].direction, 'fr-ja');
  assert.equal(queue[1].id, 'card-nomu');
});
