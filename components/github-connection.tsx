'use client';

import { useState } from 'react';
import { Github, LoaderCircle } from 'lucide-react';
import type { CloudConnectionStatus } from '@/lib/cloud-connection';
import './github-connection.css';

type Props = { status: CloudConnectionStatus | null; onDisconnect(): Promise<void> };

export function GitHubConnection({ status, onDisconnect }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function disconnect() {
    if (busy) return;
    setBusy(true); setError('');
    try { await onDisconnect(); }
    catch { setError('Could not sign out. Please try again.'); }
    finally { setBusy(false); }
  }

  if (!status) return <div className="github-connection" role="status"><div className="github-connection-heading"><LoaderCircle size={19} className="spin" aria-hidden="true" /><strong>Checking connection…</strong></div></div>;

  if (!status.configured) return <div className="github-connection"><div className="github-connection-heading"><Github size={19} aria-hidden="true" /><strong>Cloud sync is not configured yet.</strong></div><p>Your cards are saved on this device.</p></div>;

  if (!status.authenticated) return <div className="github-connection"><div className="github-connection-heading"><Github size={19} aria-hidden="true" /><strong>Connect your account</strong></div><p>Sign in to sync your flashcards. Your personal session is saved for your next visit.</p><a className="button primary github-sign-in" href="/api/auth/login"><Github size={16} aria-hidden="true" />Continue with GitHub</a></div>;

  return <div className="github-connection" aria-busy={busy}>
    <div className="github-connection-heading"><Github size={19} aria-hidden="true" /><div><strong>Cloud sync connected</strong>{status.user && <span>Signed in as @{status.user.login}</span>}</div></div>
    <button type="button" className="text-button github-sign-out" onClick={disconnect} disabled={busy}>{busy && <LoaderCircle size={14} className="spin" aria-hidden="true" />}{busy ? 'Signing out…' : 'Sign out'}</button>
    <p>Your local cards stay on this device.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
