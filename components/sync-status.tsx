'use client';

import { useState } from 'react';
import { ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';
import type { BackupState } from '@/lib/backup-status';
import type { CloudConnectionStatus } from '@/lib/cloud-connection';
import { BackupSummary } from './backup-status';
import { GitHubConnection } from './github-connection';
import './sync-status.css';

export function SyncStatusPanel({ state, status, onSync, onDisconnect }: { state: BackupState; status: CloudConnectionStatus | null; onSync: () => Promise<void>; onDisconnect: () => Promise<void> }) {
  const [error, setError] = useState('');
  async function synchronize() {
    setError('');
    try { await onSync(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'La synchronisation a échoué. Réessaie.'); }
  }
  const unavailable = state.syncing || state.saving || state.online === false || !!state.localSaveError || state.conflicts > 0;
  return <div className="sync-status-panel">
    <BackupSummary state={state} />
    <GitHubConnection status={status} onDisconnect={onDisconnect} />
    <dl className="sync-connection-details">
      <div><dt>Connexion</dt><dd>{state.online === false ? 'Hors ligne' : 'En ligne'}</dd></div>
      {status?.configured && status.repository && <div><dt>Dépôt GitHub</dt><dd><a href={`https://github.com/${status.repository}`} target="_blank" rel="noreferrer">{status.repository}<ExternalLink size={13} aria-hidden="true" /></a></dd></div>}
      {status?.configured && status.branch && <div><dt>Branche</dt><dd><code>{status.branch}</code></dd></div>}
    </dl>
    {status?.authenticated && <button type="button" className="button primary sync-now" disabled={unavailable} aria-busy={state.syncing} onClick={() => void synchronize()}>{state.syncing ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}<span aria-live="polite">{state.syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}</span></button>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
