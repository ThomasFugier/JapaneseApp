import assert from 'node:assert/strict';
import test from 'node:test';
import { cardsForDeck, descendants, dueCards, scheduleForCard, effectiveReviews, reviewCounts } from '../lib/engine';
import { mergeSnapshots } from '../lib/merge';
import { emptySnapshot, validateSnapshot } from '../lib/model';
import { backupBytes, csvText, readBackup } from '../lib/portability';
import { seedSnapshot } from '../lib/seed';

test('seed validates, parent selection deduplicates shared cards', () => {
  const data = validateSnapshot(seedSnapshot());
  assert.ok(data.notes.some(note => note.japanese === '林檎' && note.reading === 'りんご')); 
  assert.equal(cardsForDeck(data, 'japonais').length, data.cards.length);
  assert.equal(cardsForDeck(data, 'vocabulaire').filter((c) => c.id === 'card-taberu').length, 1);
  assert.ok(descendants(data, 'vocabulaire').includes('travail'));
});

test('new and reviewed cards use deterministic FSRS replay', () => {
  const data = seedSnapshot();
  const now = new Date('2026-11-09T10:00:00.000Z');
  assert.equal(dueCards(data, null, now).length, data.cards.length);
  data.reviews.push({ id: 'review-a', cardId: 'card-taberu', rating: 3, reviewedAt: now.toISOString() });
  const scheduled = scheduleForCard(data, 'card-taberu');
  assert.ok(scheduled.due.getTime() > now.getTime());
  assert.equal(scheduled.reps, 1);
  assert.ok(!dueCards(data, null, now).some((c) => c.id === 'card-taberu'));
  assert.deepEqual(scheduleForCard(data, 'card-taberu'), scheduled);
});

test('same card reviewed on two devices preserves events and replays ordered', () => {
  const base = seedSnapshot();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.reviews.push({ id: 'local-review', cardId: 'card-taberu', rating: 3, reviewedAt: '2026-11-09T10:00:00.000Z' });
  remote.reviews.push({ id: 'remote-review', cardId: 'card-taberu', rating: 2, reviewedAt: '2026-11-09T10:05:00.000Z' });
  const merged = mergeSnapshots(base, local, remote);
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.snapshot.reviews.length, 2);
  assert.equal(scheduleForCard(merged.snapshot, 'card-taberu').reps, 2);
  const again = mergeSnapshots(base, merged.snapshot, remote);
  assert.equal(again.snapshot.reviews.length, 2);
});

test('review chronology uses actual UTC instants, including imported offsets', () => {
  const data = seedSnapshot();
  data.reviews = [
    { id: 'second', cardId: 'card-taberu', rating: 3, reviewedAt: '2026-11-09T10:00:00.000Z' },
    { id: 'first', cardId: 'card-taberu', rating: 1, reviewedAt: '2026-11-09T10:30:00.000+01:00' },
  ];
  assert.doesNotThrow(() => validateSnapshot(data));
  const schedule = scheduleForCard(data, 'card-taberu');
  assert.equal(schedule.last_review?.toISOString(), '2026-11-09T10:00:00.000Z');
  assert.equal(mergeSnapshots(emptySnapshot(), data, seedSnapshot()).snapshot.reviews[0].id, 'first');
});

test('independent edits merge; incompatible edits surface conflict', () => {
  const base = seedSnapshot();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.notes[0].meaning = 'Local';
  remote.notes[1].meaning = 'Remote';
  let merged = mergeSnapshots(base, local, remote);
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.snapshot.notes.find((n) => n.id === local.notes[0].id)?.meaning, 'Local');
  remote.notes[0].meaning = 'Incompatible';
  merged = mergeSnapshots(base, local, remote);
  assert.equal(merged.conflicts.length, 1);
  assert.equal(merged.conflicts[0].collection, 'notes');
});

test('deletion tombstones survive old-device sync; orphan cards remain accessible', () => {
  const base = seedSnapshot();
  const local = structuredClone(base);
  local.notes[0].deletedAt = '2026-11-09T10:00:00.000Z';
  const result = mergeSnapshots(base, local, base).snapshot;
  assert.ok(!cardsForDeck(result, null).some((c) => c.noteId === local.notes[0].id));
  result.cards[1].deckIds = [];
  assert.ok(cardsForDeck(result, null).some((c) => c.id === result.cards[1].id));
  assert.doesNotThrow(() => validateSnapshot(result));
});

test('ZIP round-trip preserves all data including review history', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'review-export', cardId: 'card-taberu', rating: 4, reviewedAt: '2026-11-09T10:00:00.000Z' });
  assert.deepEqual(readBackup(backupBytes(data)), validateSnapshot(data));
  data.notes[0].meaning = 'Manger, "déjeuner"\nAutre ligne';
  assert.ok(csvText(data).includes('"Manger, ""déjeuner""\nAutre ligne"'));
});

test('invalid references, cycles, duplicate IDs and altered review IDs are rejected', () => {
  let data = seedSnapshot();
  data.decks[0].parentId = 'travail';
  assert.throws(() => validateSnapshot(data), /cycle/);
  data = seedSnapshot();
  data.cards[0].noteId = 'missing';
  assert.throws(() => validateSnapshot(data), /missing/);
  data = seedSnapshot();
  data.notes.push(data.notes[0]);
  assert.throws(() => validateSnapshot(data), /duplicate/);
  const base = emptySnapshot();
  const left = seedSnapshot();
  const right = seedSnapshot();
  left.reviews.push({ id: 'same', cardId: 'card-taberu', rating: 1, reviewedAt: '2026-11-09T10:00:00.000Z' });
  right.reviews.push({ ...left.reviews[0], rating: 4 });
  assert.throws(() => mergeSnapshots(base, left, right), /same ID/);
});

test('imports reject ambiguous duplicate directions and unsupported scheduler settings', () => {
  const data = seedSnapshot();
  data.cards.push({ ...data.cards[0], id: 'duplicate-direction' });
  assert.throws(() => validateSnapshot(data), /same review direction/);
  data.cards[data.cards.length - 1].deletedAt = '2026-11-09T10:00:00.000Z';
  assert.doesNotThrow(() => validateSnapshot(data));
  assert.throws(() => validateSnapshot({ ...data, scheduler: { ...data.scheduler, retention: 0.95 } }), /Invalid/);
});

test('card identity cannot be reassigned while retaining its revision history', () => {
  const base = seedSnapshot();
  const changed = structuredClone(base);
  changed.cards[0].direction = 'fr-ja';
  assert.throws(() => mergeSnapshots(base, changed, base), /different note or direction/);
});

test('deletion versus note edit surfaces the associated card choices', () => {
  const base = seedSnapshot();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  const date = '2026-11-09T10:00:00.000Z';
  local.notes[0].deletedAt = date;
  local.cards[0].deletedAt = date;
  remote.notes[0].meaning = 'Manger quelque chose';
  const merged = mergeSnapshots(base, local, remote);
  assert.ok(merged.conflicts.some((c) => c.collection === 'notes' && c.id === base.notes[0].id));
  assert.ok(merged.conflicts.some((c) => c.collection === 'cards' && c.id === base.cards[0].id));
});

test('independent deck moves cannot silently create a cycle when merged', () => {
  const base = seedSnapshot();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.decks.find((d) => d.id === 'grammaire')!.parentId = 'kanjis';
  remote.decks.find((d) => d.id === 'kanjis')!.parentId = 'grammaire';
  assert.doesNotThrow(() => validateSnapshot(local));
  assert.doesNotThrow(() => validateSnapshot(remote));
  assert.throws(() => mergeSnapshots(base, local, remote), /cycle/);
});

test('CSV protects spreadsheet cells against formula execution', () => {
  const data = seedSnapshot();
  data.notes[0].japanese = '=HYPERLINK("https://example.com")';
  data.notes[0].meaning = '  +1+2';
  const csv = csvText(data);
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'));
  assert.ok(csv.includes('"\'  +1+2"'));
  assert.equal(data.notes[0].meaning, '  +1+2');
});


test('legacy version 1 snapshots and JSON backups migrate without losing content', () => {
  const current = seedSnapshot();
  const { reviewUndos: ignored, ...content } = current;
  const legacy = { ...content, schemaVersion: 1 };
  const migrated = validateSnapshot(legacy);
  assert.equal(migrated.schemaVersion, 4);
  assert.deepEqual(migrated.reviewUndos, []);
  assert.deepEqual(migrated.notes, current.notes);
  assert.deepEqual(readBackup(new TextEncoder().encode(JSON.stringify(legacy))), migrated);
  assert.throws(() => validateSnapshot({ ...legacy, schemaVersion: 99 }), /version/);
});

test('undo retains the original event and exactly restores its previous schedule', () => {
  const data = seedSnapshot();
  data.reviews.push({ id: 'first', cardId: 'card-taberu', rating: 3, reviewedAt: '2026-11-09T10:00:00.000Z' });
  const previous = scheduleForCard(data, 'card-taberu');
  data.reviews.push({ id: 'second', cardId: 'card-taberu', rating: 4, reviewedAt: '2026-11-10T10:00:00.000Z' });
  assert.equal(scheduleForCard(data, 'card-taberu').reps, 2);
  data.reviewUndos.push({ id: 'undo-second', reviewId: 'second', undoneAt: '2026-11-10T10:00:10.000Z' });
  assert.deepEqual(scheduleForCard(data, 'card-taberu'), previous);
  assert.equal(data.reviews.length, 2);
  assert.equal(effectiveReviews(data, 'card-taberu').length, 1);
  assert.deepEqual(readBackup(backupBytes(data)), validateSnapshot(data));
});

test('an old device cannot resurrect an undone review and duplicate undo sends are harmless', () => {
  const base = seedSnapshot();
  base.reviews.push({ id: 'answer', cardId: 'card-taberu', rating: 3, reviewedAt: '2026-11-09T10:00:00.000Z' });
  const oldDevice = structuredClone(base);
  const local = structuredClone(base);
  local.reviewUndos.push({ id: 'undo-answer', reviewId: 'answer', undoneAt: '2026-11-09T10:00:10.000Z' });
  const merged = mergeSnapshots(base, local, oldDevice).snapshot;
  const repeated = mergeSnapshots(oldDevice, oldDevice, merged).snapshot;
  assert.equal(repeated.reviewUndos.length, 1);
  assert.equal(effectiveReviews(repeated, 'card-taberu').length, 0);
  assert.equal(scheduleForCard(repeated, 'card-taberu').reps, 0);
  assert.deepEqual(mergeSnapshots(base, merged, merged).snapshot, repeated);
  const independentlyUndone = structuredClone(oldDevice);
  independentlyUndone.reviewUndos.push({ id: 'second-undo', reviewId: 'answer', undoneAt: '2026-11-09T10:01:00.000Z' });
  assert.equal(scheduleForCard(mergeSnapshots(base, independentlyUndone, merged).snapshot, 'card-taberu').reps, 0);
});

test('undo references and immutable undo identities are validated', () => {
  const data = seedSnapshot();
  data.reviewUndos.push({ id: 'bad-undo', reviewId: 'missing', undoneAt: '2026-11-09T10:00:00.000Z' });
  assert.throws(() => validateSnapshot(data), /missing review/);
  assert.throws(() => mergeSnapshots(emptySnapshot(), data, seedSnapshot()), /missing review/);
  data.reviews.push({ id: 'missing', cardId: 'card-taberu', rating: 3, reviewedAt: '2026-11-09T09:59:00.000Z' });
  const changed = structuredClone(data);
  changed.reviewUndos[0].undoneAt = '2026-11-09T11:00:00.000Z';
  assert.throws(() => mergeSnapshots(data, data, changed), /different undo records/);
});

test('review counts distinguish new cards from previously reviewed due cards after undo', () => {
  const data = seedSnapshot();
  const now = new Date('2026-11-09T10:00:00.000Z');
  data.reviews.push({ id: 'due-answer', cardId: 'card-taberu', rating: 1, reviewedAt: '2026-11-09T09:00:00.000Z' });
  let counts = reviewCounts(data, 'vocabulaire', now);
  assert.equal(counts.dueCount, 1);
  assert.equal(counts.newCount, counts.total - 1);
  data.reviewUndos.push({ id: 'undo-due', reviewId: 'due-answer', undoneAt: now.toISOString() });
  counts = reviewCounts(data, 'vocabulaire', now);
  assert.equal(counts.dueCount, 0);
  assert.equal(counts.newCount, counts.total);
  assert.equal(counts.total, cardsForDeck(data, 'vocabulaire').length);
});
