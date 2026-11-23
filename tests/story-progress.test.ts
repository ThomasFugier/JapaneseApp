import assert from 'node:assert/strict';
import test from 'node:test';
import { emptySnapshot, validateSnapshot } from '../lib/model';
import { mergeSnapshots } from '../lib/merge';
import { backupBytes, readBackup } from '../lib/portability';
import { importLegacyStoryReads, setStoryRead } from '../lib/story-progress';

const at = (minute: number) => `2026-11-23T10:${String(minute).padStart(2, '0')}:00.000Z`;

test('old libraries stay valid without story progress', () => {
  assert.equal('storyProgress' in validateSnapshot(emptySnapshot()), false);
  assert.equal('storyProgress' in mergeSnapshots(emptySnapshot(), emptySnapshot(), emptySnapshot()).snapshot, false);
});

test('read and unread status both survive full backup round trips', () => {
  const read = setStoryRead(emptySnapshot(), 'first-story', true, at(1));
  const unread = setStoryRead(read, 'second-story', false, at(2));
  assert.deepEqual(readBackup(backupBytes(unread)), unread);
  assert.deepEqual(unread.storyProgress, [
    { id: 'first-story', read: true, updatedAt: at(1) },
    { id: 'second-story', read: false, updatedAt: at(2) },
  ]);
});

test('independent books read on two devices merge without conflicts', () => {
  const base = emptySnapshot();
  const local = setStoryRead(base, 'first-story', true, at(1));
  const remote = setStoryRead(base, 'second-story', true, at(2));
  const merged = mergeSnapshots(base, local, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.snapshot.storyProgress, [...local.storyProgress!, ...remote.storyProgress!]);
  assert.deepEqual(base, emptySnapshot());
});

test('a newer unread choice survives an older device and retains unknown books', () => {
  const base = setStoryRead(emptySnapshot(), 'first-story', true, at(1));
  const local = setStoryRead(base, 'first-story', false, at(3));
  const remote = setStoryRead(base, 'future-story', true, at(2));
  const merged = mergeSnapshots(base, local, remote).snapshot;
  assert.deepEqual(merged.storyProgress, [
    { id: 'first-story', read: false, updatedAt: at(3) },
    { id: 'future-story', read: true, updatedAt: at(2) },
  ]);
  assert.deepEqual(mergeSnapshots(merged, emptySnapshot(), merged).snapshot.storyProgress, merged.storyProgress);
});

test('simultaneous choices merge deterministically across equivalent time zones', () => {
  const base = emptySnapshot();
  const local = setStoryRead(base, 'first-story', true, '2026-11-23T12:05:00+02:00');
  const remote = setStoryRead(base, 'first-story', false, at(5));
  const forward = mergeSnapshots(base, local, remote).snapshot.storyProgress;
  assert.equal(forward?.[0].read, false);
  assert.deepEqual(forward, mergeSnapshots(base, remote, local).snapshot.storyProgress);
});

test('rapid toggles and a clock moving backwards still preserve the last choice', () => {
  const read = setStoryRead(emptySnapshot(), 'first-story', true, at(5));
  const unread = setStoryRead(read, 'first-story', false, at(5));
  const reread = setStoryRead(unread, 'first-story', true, at(1));
  assert.equal(reread.storyProgress?.length, 1);
  assert.equal(reread.storyProgress?.[0].read, true);
  assert.equal(Date.parse(reread.storyProgress![0].updatedAt), Date.parse(at(5)) + 2);
});

test('legacy browser flags migrate once without resurrecting a saved unread choice', () => {
  const saved = setStoryRead(emptySnapshot(), 'first-story', false, at(1));
  const migrated = importLegacyStoryReads(saved, ['first-story', 'second-story', 'second-story']);
  assert.deepEqual(migrated.storyProgress, [
    { id: 'first-story', read: false, updatedAt: at(1) },
    { id: 'second-story', read: true, updatedAt: '1970-01-01T00:00:00.000Z' },
  ]);
  assert.equal(importLegacyStoryReads(migrated, ['first-story', 'second-story']), migrated);
  const remote = setStoryRead(emptySnapshot(), 'second-story', false, at(2));
  assert.equal(mergeSnapshots(emptySnapshot(), migrated, remote).snapshot.storyProgress?.find(record => record.id === 'second-story')?.read, false);
});

test('story changes preserve other library data and reject malformed progress', () => {
  const base = emptySnapshot();
  base.lessonProgress = [{ id: 'comparisons', validated: true, updatedAt: at(1) }];
  const changed = setStoryRead(base, 'first-story', true, at(2));
  const { storyProgress, ...rest } = changed;
  assert.deepEqual(rest, base);
  assert.throws(() => validateSnapshot({ ...base, storyProgress: [storyProgress![0], storyProgress![0]] }), /duplicate IDs/);
  assert.throws(() => validateSnapshot({ ...base, storyProgress: [{ id: 'first-story', read: 'yes', updatedAt: at(1) }] }));
  assert.throws(() => validateSnapshot({ ...base, storyProgress: [{ id: 'first-story', read: true, updatedAt: 'yesterday' }] }));
});
