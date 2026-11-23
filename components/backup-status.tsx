'use client';

import { useState } from 'react';
import { Cloud, HardDrive, LoaderCircle, Save } from 'lucide-react';
import { deriveBackupStatus, type BackupState } from '@/lib/backup-status';
import './backup-status.css';

export type BackupIndicatorProps = { state: BackupState; onOpen: () => void; open?: boolean };
export type BackupSummaryProps = { state: BackupState };

export function BackupIndicator({ state, onOpen, open = false }: BackupIndicatorProps) {
  const status = deriveBackupStatus(state);
  const busy = status.kind === 'saving' || (state.syncing && state.online !== false);
  return <button type="button" className={'backup-indicator backup-indicator--' + status.kind + (busy && status.kind !== 'error' ? ' is-busy' : '')} onClick={onOpen} aria-label={'Synchronisation. ' + status.description} aria-haspopup="dialog" aria-expanded={open} title={'Synchronisation · ' + status.label}>
    <span className="backup-indicator-symbol" aria-hidden="true"><Cloud size={17} /><span className="backup-indicator-dot" /></span>
    <span className="backup-indicator-label">Sync</span>
  </button>;
}

export function SaveNowButton({ state, onSave, onError }: { state: BackupState; onSave: () => Promise<void>; onError: (message: string) => void }) {
  const [pending, setPending] = useState(false);
  async function save() {
    if (pending) return;
    setPending(true);
    try { await onSave(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : 'La sauvegarde a échoué. Réessaie.'); }
    finally { setPending(false); }
  }
  return <button type="button" className="save-now-button" aria-label="Sauvegarder maintenant" title="Sauvegarder maintenant" aria-busy={pending} disabled={pending || state.saving || state.syncing} onClick={() => void save()}>
    {pending ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
    <span>{pending ? 'Sauvegarde…' : 'Sauvegarder'}</span>
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
