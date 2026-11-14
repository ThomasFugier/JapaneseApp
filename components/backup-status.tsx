'use client';

import { Cloud, HardDrive } from 'lucide-react';
import { deriveBackupStatus, type BackupState } from '@/lib/backup-status';
import './backup-status.css';

export type BackupIndicatorProps = { state: BackupState; onOpen: () => void };
export type BackupSummaryProps = { state: BackupState };

export function BackupIndicator({ state, onOpen }: BackupIndicatorProps) {
  const status = deriveBackupStatus(state);
  const busy = status.kind === 'saving' || (state.syncing && state.online !== false);
  return <button type="button" className={'backup-indicator backup-indicator--' + status.kind + (busy && status.kind !== 'error' ? ' is-busy' : '')} onClick={onOpen} aria-label={status.description + ' Open backup settings.'} title={status.description}>
    <span className="backup-indicator-dot" aria-hidden="true" />
  </button>;
}

export function BackupSummary({ state }: BackupSummaryProps) {
  const status = deriveBackupStatus(state);
  return <section className="backup-summary" aria-label="Backup status">
    <div className={'backup-summary-row' + (status.local.problem ? ' has-problem' : '')}>
      <HardDrive size={17} aria-hidden="true" />
      <div><h3>{status.local.label}</h3><p>{status.local.description}</p></div>
    </div>
    <div className={'backup-summary-row' + (status.github.problem ? ' has-problem' : '')}>
      <Cloud size={17} aria-hidden="true" />
      <div><h3>{status.github.label}</h3><p>{status.github.description}</p>
        {status.lastSyncedAt && <p className="backup-last-sync">Last successful sync: <time dateTime={status.lastSyncedAt}>{new Date(status.lastSyncedAt).toLocaleString('en-GB')}</time></p>}
      </div>
    </div>
  </section>;
}
