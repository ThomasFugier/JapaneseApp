import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveBackupStatus, type BackupState } from '../lib/backup-status';

const saved: BackupState = {
  saving: false, syncing: false, localSaveError: '', syncError: '', connected: true,
  dirty: false, lastSyncedAt: '2026-11-09T10:00:00.000Z', conflicts: 0,
};

test('Synced requires a connection and a successful timestamp', () => {
  assert.equal(deriveBackupStatus(saved).shortLabel, 'Synced');
  for (const lastSyncedAt of [null, '', 'not-a-date']) {
    const status = deriveBackupStatus({ ...saved, lastSyncedAt });
    assert.equal(status.shortLabel, 'Pending');
    assert.equal(status.github.label, 'GitHub not yet synced');
    assert.equal(status.lastSyncedAt, null);
  }
});

test('an old successful sync does not claim a disconnected device is synced', () => {
  const status = deriveBackupStatus({ ...saved, connected: false });
  assert.equal(status.shortLabel, 'Local');
  assert.equal(status.github.label, 'GitHub not connected');
  assert.equal(status.lastSyncedAt, saved.lastSyncedAt);
});

test('dirty changes remain pending despite a prior successful sync', () => {
  const status = deriveBackupStatus({ ...saved, dirty: true });
  assert.equal(status.shortLabel, 'Pending');
  assert.equal(status.local.label, 'Saved on this device');
  assert.equal(status.github.label, 'GitHub sync pending');
});

test('active local writes never claim the latest change is saved or synced', () => {
  const status = deriveBackupStatus({ ...saved, saving: true });
  assert.equal(status.shortLabel, 'Saving');
  assert.equal(status.local.label, 'Saving on this device');
  assert.equal(status.github.label, 'GitHub sync pending');
});

test('an active GitHub attempt does not claim sync completed', () => {
  const status = deriveBackupStatus({ ...saved, syncing: true });
  assert.equal(status.shortLabel, 'Pending');
  assert.equal(status.github.label, 'Syncing with GitHub');
  assert.equal(status.local.label, 'Saved on this device');
});

test('local save failures stay visible during a later save or sync attempt', () => {
  const localSaveError = 'The last change could not be saved.';
  for (const progress of [{}, { saving: true }, { syncing: true }, { connected: false }]) {
    const status = deriveBackupStatus({ ...saved, ...progress, localSaveError });
    assert.equal(status.shortLabel, 'Error');
    assert.equal(status.local.problem, true);
    assert.equal(status.local.description, localSaveError);
    assert.notEqual(status.github.label, 'Synced with GitHub');
  }
});

test('GitHub sync failure preserves the independent local saved status', () => {
  const status = deriveBackupStatus({ ...saved, syncError: 'GitHub is unavailable.' });
  assert.equal(status.shortLabel, 'Error');
  assert.equal(status.github.label, 'GitHub sync failed');
  assert.equal(status.github.description, 'GitHub is unavailable.');
  assert.equal(status.local.label, 'Saved on this device');
  assert.equal(status.local.problem, false);
  assert.equal(status.lastSyncedAt, saved.lastSyncedAt);
});

test('unresolved conflicts need attention even with a clean snapshot', () => {
  const status = deriveBackupStatus({ ...saved, conflicts: 2 });
  assert.equal(status.shortLabel, 'Error');
  assert.equal(status.github.label, 'GitHub needs attention');
  assert.match(status.github.description, /Choose which versions/);
  assert.equal(status.local.label, 'Saved on this device');
});

test('disconnected changes are local, even with a stale remote error', () => {
  const status = deriveBackupStatus({ ...saved, connected: false, dirty: true, syncError: 'Old remote error.' });
  assert.equal(status.shortLabel, 'Local');
  assert.equal(status.github.label, 'GitHub not connected');
});

test('offline progress never claims to be synced or disconnected, including after reload', () => {
  for (const progress of [{}, { dirty: true }, { connected: false }, { syncError: 'Network lost.' }, { syncing: true }]) {
    const status = deriveBackupStatus({ ...saved, ...progress, online: false });
    assert.equal(status.shortLabel, 'Offline');
    assert.equal(status.local.label, 'Saved on this device');
    assert.match(status.github.description, /Synchronization resumes/);
    assert.equal(status.github.problem, false);
  }
});

test('offline mode still surfaces local write failures and returns to pending on reconnection', () => {
  assert.equal(deriveBackupStatus({ ...saved, online: false, localSaveError: 'Disk full.' }).shortLabel, 'Error');
  assert.equal(deriveBackupStatus({ ...saved, online: false, saving: true }).shortLabel, 'Saving');
  assert.equal(deriveBackupStatus({ ...saved, online: true, dirty: true }).shortLabel, 'Pending');
});
