'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Github, LoaderCircle } from 'lucide-react';
import { parseRepository, type GitHubConfig } from '@/lib/github-client';
import './github-connection.css';

type Props = { connected: boolean; repository: string | null; onConnect(config: GitHubConfig): Promise<void>; onDisconnect(): void };
const PREFERENCE_KEY = 'kotoba-github-repository-v1';

export function GitHubConnection({ connected, repository, onConnect, onDisconnect }: Props) {
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFERENCE_KEY) || 'null');
      if (saved && typeof saved.repository === 'string') {
        const parsed = parseRepository(saved.repository); setRepo(`${parsed.owner}/${parsed.repo}`);
        if (typeof saved.branch === 'string' && saved.branch.length < 256) setBranch(saved.branch || 'main');
      }
    } catch { /* No credential is read from persistent storage. */ }
  }, []);

  async function connect(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const parsed = parseRepository(repo);
      const config = { ...parsed, branch: branch.trim() || 'main', token: token.trim() };
      await onConnect(config);
      setToken('');
      try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ repository: `${parsed.owner}/${parsed.repo}`, branch: config.branch })); } catch { /* Optional non-secret preference. */ }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Connexion impossible.'); }
    finally { setBusy(false); }
  }

  if (connected) return <div className="github-connected"><div><Github size={19} /><span><strong>GitHub connecté</strong><span>{repository}</span></span></div><button type="button" className="text-button" onClick={() => { setToken(''); onDisconnect(); }}>Déconnecter</button><p>Clé conservée pour cette session uniquement.</p></div>;
  return <form className="github-connection-form" onSubmit={connect}>
    <label>Dépôt privé<input required maxLength={300} placeholder="ThomasFugier/kotoba-data" value={repo} onChange={event => setRepo(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
    <label>Branche<input required maxLength={255} value={branch} onChange={event => setBranch(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
    <label>Clé GitHub<input required type="password" name="kotoba-github-token" maxLength={1024} value={token} onChange={event => setToken(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="github_pat_…" /></label>
    <p>Dépôt privé, initialisé avec un README. Clé conservée pour cette session uniquement, avec Contents en lecture/écriture pour ce seul dépôt.</p>
    <div className="github-setup-links"><a className="github-token-link" href="https://github.com/new" target="_blank" rel="noopener noreferrer">Créer un dépôt<ExternalLink size={12} /></a><a className="github-token-link" href="https://github.com/settings/personal-access-tokens/new?name=Kotoba&contents=write" target="_blank" rel="noopener noreferrer">Créer une clé limitée à ce dépôt<ExternalLink size={12} /></a></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button primary" type="submit" disabled={busy || !repo.trim() || !token.trim()}>{busy ? <LoaderCircle size={16} className="spin" /> : <Github size={16} />}{busy ? 'Connexion…' : 'Connecter'}</button>
  </form>;
}
