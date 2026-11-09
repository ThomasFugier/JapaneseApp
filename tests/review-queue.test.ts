import test from 'node:test';
import assert from 'node:assert/strict';
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

test('mixing directions keeps the earliest review deadlines first', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'queue-reviewed', cardId: data.cards[0].id, rating: 3, reviewedAt: '2026-11-09T10:00:00.000Z' });
  const queue = dueCards(data, null, new Date('2026-11-10T10:00:00.000Z'));
  const deadlines = queue.map(card => scheduleForCard(data, card.id).due.getTime());
  assert.deepEqual(deadlines, [...deadlines].sort((a, b) => a - b));
  assert.ok(queue.some(card => card.id === data.cards[0].id));
});
