import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSnapshot } from '../lib/model';
import { seedSnapshot } from '../lib/seed';
import { backupBytes, readBackup, csvText } from '../lib/portability';

test('ON/KUN readings survive validation, ZIP backup and CSV export', () => {
  const data = seedSnapshot();
  data.notes[0].onReadings = ['ショク'];
  data.notes[0].kunReadings = ['た.べる', 'く.う'];
  const result = readBackup(backupBytes(validateSnapshot(data)));
  assert.deepEqual(result.notes[0].onReadings, ['ショク']);
  assert.deepEqual(result.notes[0].kunReadings, ['た.べる', 'く.う']);
  assert.ok(csvText(data).includes('on_readings,kun_readings'));
  assert.ok(csvText(data).includes('た.べる | く.う'));
});

test('version 2 libraries upgrade without losing review undo history', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'review', cardId: data.cards[0].id, rating: 3, reviewedAt: '2026-11-09T10:00:00.000Z' });
  data.reviewUndos.push({ id: 'undo', reviewId: 'review', undoneAt: '2026-11-09T10:01:00.000Z' });
  const migrated = validateSnapshot({ ...data, schemaVersion: 2 });
  assert.equal(migrated.schemaVersion, 4);
  assert.deepEqual(migrated.reviews, data.reviews);
  assert.deepEqual(migrated.reviewUndos, data.reviewUndos);
});
