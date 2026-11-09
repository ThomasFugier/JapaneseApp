'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySnapshot, snapshotsEqual, validateSnapshot, type Snapshot } from '@/lib/model';
import { seedSnapshot } from '@/lib/seed';
import { loadLibrary, saveLibrary } from '@/lib/storage';
import { mergeSnapshots, type Conflict } from '@/lib/merge';
import { readGitHub, syncGitHub, type GitHubConfig } from '@/lib/github-client';

type Status = { configured: boolean; authenticated: boolean; user?: { login: string }; reason?: string };
type Library = { snapshot: Snapshot; base: Snapshot; lastSyncedAt: string | null };

export function useLibrary() {
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [manualRepository, setManualRepository] = useState<string | null>(null);
  const manualConfig = useRef<GitHubConfig | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const record = useRef<Library | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);
  const conflictData = useRef<{ snapshot: Snapshot; remote: Snapshot; captured: Snapshot } | null>(null);
  const mounted = useRef(true);

  const persist = useCallback((next: Library) => {
    const previous = record.current;
    record.current = next;
    setData(next.snapshot);
    setLastSyncedAt(next.lastSyncedAt);
    setSaving(true);
    const task = queue.current.catch(() => undefined).then(() => saveLibrary(next));
    queue.current = task;
    task.then(() => { if (mounted.current && queue.current === task) setSaving(false); }).catch(() => {
      if (mounted.current) {
        if (queue.current === task && record.current === next && previous) {
          record.current = previous; setData(previous.snapshot); setLastSyncedAt(previous.lastSyncedAt);
        }
        setSaving(false); setError('Sauvegarde locale impossible. La dernière action n’a pas été enregistrée. Exportez vos données et vérifiez l’espace disponible.');
      }
    });
    return task;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let release: (() => void) | undefined;
    async function initialize() {
      try {
        const stored = await loadLibrary();
        let remoteStatus: Status | null = null;
        try { remoteStatus = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(response => response.json()); } catch { /* Offline mode. */ }
        if (disposed) return;
        setStatus(remoteStatus);
        let value: Library = stored ?? { snapshot: remoteStatus?.configured ? emptySnapshot() : seedSnapshot(), base: emptySnapshot(), lastSyncedAt: null };
        // A new connected device starts from GitHub, never from demonstration cards.
        if (!stored && remoteStatus?.authenticated) {
          const response = await fetch('/api/sync', { cache: 'no-store', signal: AbortSignal.timeout(45000) });
          const remote = await response.json();
          if (!response.ok) throw new Error(remote.error || 'Impossible de charger votre bibliothèque GitHub. Réessayez en rechargeant la page.');
          if (remote.revision) {
            const snapshot = validateSnapshot(remote.snapshot);
            value = { snapshot, base: snapshot, lastSyncedAt: new Date().toISOString() };
          }
        }
        if (disposed) return;
        if (!stored) await saveLibrary(value);
        if (disposed) return;
        record.current = value; setData(value.snapshot); setLastSyncedAt(value.lastSyncedAt); setReady(true);
        const auth = new URLSearchParams(window.location.search).get('auth');
        if (auth === 'error') setError('Connexion GitHub refusée ou interrompue. Vérifiez le compte autorisé et réessayez.');
        if (auth === 'success') setNotice('Compte GitHub connecté. Chargement de votre bibliothèque…');
        if (auth) window.history.replaceState({}, '', '/');
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Stockage inaccessible. Rechargez la page. Aucune donnée existante n’a été remplacée.');
      }
    }
    if (navigator.locks) {
      const acquire = (retry: boolean) => { void navigator.locks.request('kotoba-library', { ifAvailable: true }, async lock => {
        if (disposed) return;
        if (!lock) {
          // React development remounts can briefly retain the previous lock.
          if (retry) { window.setTimeout(() => { if (!disposed) acquire(false); }, 100); return; }
          setError('Japonais est déjà ouvert dans un autre onglet. Fermez l’autre onglet puis rechargez cette page pour protéger vos modifications.'); return;
        }
        await initialize();
        if (!disposed) await new Promise<void>(resolve => { release = resolve; });
      }).catch(() => { if (!disposed) setError('Impossible de verrouiller le stockage local. Rechargez la page.'); }); };
      acquire(true);
    } else void initialize();
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(registration => {
        const cache = () => registration.active?.postMessage({ type: 'CACHE_ASSETS', urls: performance.getEntriesByType('resource').map(entry => entry.name) });
        cache(); navigator.serviceWorker.addEventListener('controllerchange', cache, { once: true });
      }).catch(() => { /* Local data remains available without offline shell. */ });
    }
    navigator.storage?.persist?.().catch(() => undefined);
    return () => { disposed = true; mounted.current = false; release?.(); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const refreshStatus = () => {
      if (!navigator.onLine) return;
      void fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(response => response.json()).then((next: Status) => {
        setStatus(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      }).catch(() => undefined);
    };
    window.addEventListener('online', refreshStatus); window.addEventListener('focus', refreshStatus);
    return () => { window.removeEventListener('online', refreshStatus); window.removeEventListener('focus', refreshStatus); };
  }, [ready]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (saving) event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [saving]);

  const update = useCallback((fn: (snapshot: Snapshot) => Snapshot) => {
    if (!record.current) return Promise.resolve();
    return persist({ ...record.current, snapshot: fn(structuredClone(record.current.snapshot)) });
  }, [persist]);

  const connectGitHub = useCallback(async (config: GitHubConfig) => {
    if (!record.current || busy.current) throw new Error('Une opération est déjà en cours. Réessayez.');
    busy.current = true; setSyncing(true);
    try {
      await queue.current;
      const remote = await readGitHub(config);
      // Demonstration content must not pollute an existing personal repository.
      if (remote.revision && snapshotsEqual(record.current.snapshot, seedSnapshot()) && snapshotsEqual(record.current.base, emptySnapshot())) {
        await persist({ snapshot: remote.snapshot, base: remote.snapshot, lastSyncedAt: new Date().toISOString() });
      }
      manualConfig.current = { ...config };
      setManualRepository(`${config.owner}/${config.repo}`);
      setError(''); setNotice('Dépôt GitHub connecté.');
    } finally { busy.current = false; setSyncing(false); }
  }, [persist]);

  const disconnectGitHub = useCallback(() => {
    if (busy.current) { setNotice('Attendez la fin de la synchronisation.'); return; }
    manualConfig.current = null; setManualRepository(null);
    setNotice('Connexion GitHub fermée. Vos données locales sont conservées.');
  }, []);

  const sync = useCallback(async () => {
    if (!record.current || busy.current || conflictData.current) return;
    if (!manualConfig.current && !status?.authenticated) { setNotice('Connectez votre dépôt GitHub dans les paramètres.'); return; }
    if (!navigator.onLine) { setNotice('Hors connexion. Vos modifications restent sur cet appareil.'); return; }
    busy.current = true; setSyncing(true); setError('');
    try {
      await queue.current;
      const sent = structuredClone(record.current);
      let result: Awaited<ReturnType<typeof syncGitHub>>;
      if (manualConfig.current) result = await syncGitHub(manualConfig.current, sent.base, sent.snapshot);
      else {
        const response = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: sent.base, snapshot: sent.snapshot }), signal: AbortSignal.timeout(60000) });
        const payload = await response.json();
        if (response.status === 401) setStatus(previous => ({ configured: previous?.configured ?? true, authenticated: false }));
        if (!response.ok && !(response.status === 409 && Array.isArray(payload.conflicts))) throw new Error(payload.error || 'Synchronisation indisponible.');
        result = { ...payload, conflict: response.status === 409 };
      }
      if (result.conflict) {
        const captured = structuredClone(record.current.snapshot);
        const rebased = mergeSnapshots(sent.snapshot, captured, result.snapshot);
        const choices = new Map<string, Conflict>();
        for (const conflict of result.conflicts as Conflict[]) {
          choices.set(`${conflict.collection}:${conflict.id}`, { ...conflict, local: captured[conflict.collection].find(item => item.id === conflict.id) ?? conflict.local });
        }
        for (const conflict of rebased.conflicts) choices.set(`${conflict.collection}:${conflict.id}`, conflict);
        conflictData.current = { snapshot: rebased.snapshot, remote: result.remote, captured };
        setConflicts([...choices.values()]); return;
      }
      const after = mergeSnapshots(sent.snapshot, record.current.snapshot, result.snapshot);
      if (after.conflicts.length) {
        conflictData.current = { snapshot: after.snapshot, remote: result.snapshot, captured: structuredClone(record.current.snapshot) }; setConflicts(after.conflicts); return;
      }
      await persist({ snapshot: validateSnapshot(after.snapshot), base: validateSnapshot(result.snapshot), lastSyncedAt: result.lastSyncedAt ?? new Date().toISOString() });
      setNotice('Vos appareils sont synchronisés.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Synchronisation impossible. Vos données restent sur cet appareil.'); }
    finally { busy.current = false; setSyncing(false); }
  }, [persist, status, manualRepository]);

  useEffect(() => {
    if (!ready || !(manualRepository || status?.authenticated) || !record.current || JSON.stringify(record.current.snapshot) === JSON.stringify(record.current.base)) return;
    const timer = setTimeout(() => { void sync(); }, 15000);
    return () => clearTimeout(timer);
  }, [data, ready, status, manualRepository, sync]);

  useEffect(() => {
    if (!ready || !(manualRepository || status?.authenticated)) return;
    void sync();
    const onFocus = () => { void sync(); };
    window.addEventListener('online', onFocus); window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('online', onFocus); window.removeEventListener('focus', onFocus); };
  }, [ready, status, manualRepository, sync]);

  const resolve = useCallback(async (choices: Record<string, 'local' | 'remote'>) => {
    const pending = conflictData.current;
    if (!pending || !record.current) return;
    const rebased = mergeSnapshots(pending.captured, record.current.snapshot, pending.snapshot);
    const current = rebased.snapshot;
    const unexpected = rebased.conflicts.filter(conflict => !conflicts.some(known => known.collection === conflict.collection && known.id === conflict.id));
    if (unexpected.length) {
      conflictData.current = { ...pending, snapshot: current, captured: structuredClone(record.current.snapshot) };
      setConflicts([...conflicts, ...unexpected]);
      setNotice('Une modification supplémentaire nécessite votre choix.'); return;
    }
    for (const conflict of conflicts) {
      const collection = current[conflict.collection] as Array<{ id: string }>;
      const chosen = choices[`${conflict.collection}:${conflict.id}`] === 'remote' ? conflict.remote : record.current.snapshot[conflict.collection].find(item => item.id === conflict.id) ?? conflict.local;
      const index = collection.findIndex(item => item.id === conflict.id);
      if (index >= 0) collection.splice(index, 1);
      if (chosen) collection.push(chosen);
    }
    await persist({ ...record.current, snapshot: validateSnapshot(current), base: validateSnapshot(pending.remote) });
    conflictData.current = null; setConflicts([]); setNotice('Versions choisies enregistrées. Synchronisez pour les envoyer sur GitHub.');
  }, [conflicts, persist]);

  const dirty = !!record.current && JSON.stringify(data) !== JSON.stringify(record.current.base);
  const connectionStatus: Status | null = manualRepository ? { configured: true, authenticated: true } : status;
  return { data, ready, saving, syncing, status: connectionStatus, serverStatus: status, error, setError, notice, setNotice, lastSyncedAt, dirty, conflicts, update, sync, resolve, manualRepository, connectGitHub, disconnectGitHub };
}
