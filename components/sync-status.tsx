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
  const [pending, setPending] = useState(false);
  async function synchronize() {
    if (pending) return;
    setPending(true); setError('');
    try { await onSync(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'La sauvegarde a échoué. Réessaie.'); }
    finally { setPending(false); }
  }
  const unavailable = pending || state.syncing || state.saving;
  return <div className="sync-status-panel">
    <BackupSummary state={state} />
    <GitHubConnection status={status} onDisconnect={onDisconnect} />
    <dl className="sync-connection-details">
      <div><dt>Connexion</dt><dd>{state.online === false ? 'Hors ligne' : 'En ligne'}</dd></div>
      {status?.configured && status.repository && <div><dt>Dépôt GitHub</dt><dd><a href={`https://github.com/${status.repository}`} target="_blank" rel="noreferrer">{status.repository}<ExternalLink size={13} aria-hidden="true" /></a></dd></div>}
      {status?.configured && status.branch && <div><dt>Branche</dt><dd><code>{status.branch}</code></dd></div>}
    </dl>
    <button type="button" className="button primary sync-now" disabled={unavailable} aria-busy={pending} onClick={() => void synchronize()}>{pending ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}<span aria-live="polite">{pending ? 'Sauvegarde…' : 'Sauvegarder maintenant'}</span></button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
