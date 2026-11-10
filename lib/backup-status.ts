export type BackupState = {
  saving: boolean;
  syncing: boolean;
  localSaveError: string;
  syncError: string;
  connected: boolean;
  online?: boolean;
  dirty: boolean;
  lastSyncedAt: string | null;
  conflicts: number;
};

type Detail = { label: string; description: string; problem: boolean };
export type BackupStatus = {
  kind: 'local' | 'saving' | 'synced' | 'pending' | 'offline' | 'error';
  label: string;
  shortLabel: 'Local' | 'Saving' | 'Synced' | 'Pending' | 'Offline' | 'Error';
  description: string;
  local: Detail;
  github: Detail;
  lastSyncedAt: string | null;
};

export function deriveBackupStatus(state: BackupState): BackupStatus {
  const lastSyncedAt = state.lastSyncedAt && Number.isFinite(Date.parse(state.lastSyncedAt)) ? state.lastSyncedAt : null;
  const local: Detail = state.localSaveError
    ? { label: 'Local save failed', description: state.localSaveError, problem: true }
    : state.saving
      ? { label: 'Saving on this device', description: 'Saving your latest changes.', problem: false }
      : { label: 'Saved on this device', description: 'Your library and review progress are saved in this browser.', problem: false };
  let github: Detail;
  if (state.online === false) github = { label: 'Offline', description: 'Changes stay on this device. Synchronization resumes when you are back online with the site open.', problem: false };
  else if (!state.connected) github = { label: 'GitHub not connected', description: 'Connect GitHub to sync across devices.', problem: false };
  else if (state.conflicts > 0) github = { label: 'GitHub needs attention', description: 'Choose which versions to keep before synchronization can continue.', problem: true };
  else if (state.syncError) github = { label: 'GitHub sync failed', description: state.syncError, problem: true };
  else if (state.localSaveError) github = { label: 'GitHub sync pending', description: 'Resolve the local save failure before syncing.', problem: false };
  else if (state.syncing) github = { label: 'Syncing with GitHub', description: 'Sending and checking the latest changes.', problem: false };
  else if (state.dirty || state.saving) github = { label: 'GitHub sync pending', description: 'Changes have not reached GitHub yet.', problem: false };
  else if (!lastSyncedAt) github = { label: 'GitHub not yet synced', description: 'Connected. A first successful sync has not been confirmed.', problem: false };
  else github = { label: 'Synced with GitHub', description: 'This device matches the last successful GitHub sync.', problem: false };

  let kind: BackupStatus['kind'];
  let label: string;
  let shortLabel: BackupStatus['shortLabel'];
  if (local.problem) { kind = 'error'; label = local.label; shortLabel = 'Error'; }
  else if (state.saving) { kind = 'saving'; label = local.label; shortLabel = 'Saving'; }
  else if (state.online === false) { kind = 'offline'; label = github.label; shortLabel = 'Offline'; }
  else if (!state.connected) { kind = 'local'; label = local.label; shortLabel = 'Local'; }
  else if (github.problem) { kind = 'error'; label = github.label; shortLabel = 'Error'; }
  else if (state.syncing || state.dirty || !lastSyncedAt) { kind = 'pending'; label = github.label; shortLabel = 'Pending'; }
  else { kind = 'synced'; label = github.label; shortLabel = 'Synced'; }

  return { kind, label, shortLabel, description: local.label + '. ' + github.label + '. ' + local.description + ' ' + github.description, local, github, lastSyncedAt };
}
