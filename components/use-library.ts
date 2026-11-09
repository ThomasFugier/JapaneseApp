'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySnapshot, snapshotsEqual, validateSnapshot, type Snapshot } from '@/lib/model';
import { isUnmodifiedSample, seedSnapshot } from '@/lib/seed';
import { loadLibrary, saveLibrary } from '@/lib/storage';
import { mergeSnapshots, type Conflict } from '@/lib/merge';
import { readGitHub, syncGitHub, type GitHubConfig } from '@/lib/github-client';

type Status = { configured: boolean; authenticated: boolean; user?: { login: string }; reason?: string };
type Library = { snapshot: Snapshot; base: Snapshot; lastSyncedAt: string | null };
const localSaveFailure = 'Local save failed. Your last action was not saved. Export your data and check the available storage space.';

export function useLibrary() {
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [localSaveError, setLocalSaveError] = useState('');
  const [syncError, setSyncError] = useState('');
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
    task.then(() => {
      if (mounted.current) { setLocalSaveError(''); setError(previous => previous === localSaveFailure ? '' : previous); if (queue.current === task) setSaving(false); }
    }).catch(() => {
      if (mounted.current) {
        if (queue.current === task && record.current === next && previous) {
          record.current = previous; setData(previous.snapshot); setLastSyncedAt(previous.lastSyncedAt);
        }
        setSaving(false); setLocalSaveError(localSaveFailure); setError(localSaveFailure);
      }
    });
    return task;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let release: (() => void) | undefined;
    async function initialize() {
      let loadingRemote = false;
      try {
        const stored = await loadLibrary();
        let remoteStatus: Status | null = null;
        try { remoteStatus = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(response => response.json()); } catch { /* Offline mode. */ }
        if (disposed) return;
        setStatus(remoteStatus);
        let value: Library = stored ?? { snapshot: remoteStatus?.configured ? emptySnapshot() : seedSnapshot(), base: emptySnapshot(), lastSyncedAt: null };
        // A new connected device starts from GitHub, never from demonstration cards.
        if (!stored && remoteStatus?.authenticated) {
          loadingRemote = true;
          const response = await fetch('/api/sync', { cache: 'no-store', signal: AbortSignal.timeout(45000) });
          const remote = await response.json();
          if (!response.ok) throw new Error(remote.error || 'Unable to load your GitHub library. Reload the page to try again.');
          if (remote.revision) {
            const snapshot = validateSnapshot(remote.snapshot);
            value = { snapshot, base: snapshot, lastSyncedAt: new Date().toISOString() };
          }
          loadingRemote = false;
        }
        if (disposed) return;
        if (!stored) {
          try { await saveLibrary(value); if (!disposed) setLocalSaveError(''); }
          catch (cause) { if (!disposed) setLocalSaveError(localSaveFailure); throw cause; }
        }
        if (disposed) return;
        record.current = value; setData(value.snapshot); setLastSyncedAt(value.lastSyncedAt); setReady(true);
        const auth = new URLSearchParams(window.location.search).get('auth');
        if (auth === 'error') {
          const message = 'GitHub sign-in was denied or interrupted. Check the authorized account and try again.';
          setSyncError(message); setError(message);
        }
        if (auth === 'success') setNotice('GitHub account connected. Loading your library…');
        if (auth) window.history.replaceState({}, '', '/');
      } catch (cause) {
        if (!disposed) {
          const message = cause instanceof Error ? cause.message : 'Storage is unavailable. Reload the page. No existing data was replaced.';
          if (loadingRemote) setSyncError(message);
          setError(message);
        }
      }
    }
    if (navigator.locks) {
      const acquire = (retry: boolean) => { void navigator.locks.request('kotoba-library', { ifAvailable: true }, async lock => {
        if (disposed) return;
        if (!lock) {
          // React development remounts can briefly retain the previous lock.
          if (retry) { window.setTimeout(() => { if (!disposed) acquire(false); }, 100); return; }
          setError('Japanese is already open in another tab. Close the other tab, then reload this page to protect your changes.'); return;
        }
        await initialize();
        if (!disposed) await new Promise<void>(resolve => { release = resolve; });
      }).catch(() => { if (!disposed) setError('Unable to lock local storage. Reload the page.'); }); };
      acquire(true);
    } else void initialize();
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(registration => {
        const cache = () => registration.active?.postMessage({ type: 'CACHE_ASSETS', urls: performance.getEntriesByType('resource').map(entry => entry.name) });
        cache(); navigator.serviceWorker.addEventListener('controllerchange', cache, { once: true });
        void document.fonts.ready.then(cache);
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
    if (!record.current || busy.current) throw new Error('An operation is already in progress. Try again.');
    busy.current = true; setSyncing(true);
    let readingRemote = false;
    try {
      await queue.current;
      readingRemote = true;
      const remote = await readGitHub(config);
      readingRemote = false; setSyncError('');
      // Demonstration content must not pollute an existing personal repository.
      if (remote.revision && isUnmodifiedSample(record.current.snapshot) && snapshotsEqual(record.current.base, emptySnapshot())) {
        await persist({ snapshot: remote.snapshot, base: remote.snapshot, lastSyncedAt: new Date().toISOString() });
      }
      manualConfig.current = { ...config };
      setManualRepository(`${config.owner}/${config.repo}`);
      setError(''); setNotice('GitHub repository connected.');
    } catch (cause) {
      if (readingRemote) setSyncError(cause instanceof Error ? cause.message : 'Unable to connect to GitHub.');
      throw cause;
    } finally { busy.current = false; setSyncing(false); }
  }, [persist]);

  const disconnectGitHub = useCallback(() => {
    if (busy.current) { setNotice('Wait for synchronization to finish.'); return; }
    manualConfig.current = null; setManualRepository(null); setSyncError('');
    setNotice('GitHub disconnected. Your local data is preserved.');
  }, []);

  const sync = useCallback(async () => {
    if (!record.current || busy.current || conflictData.current) return;
    if (!manualConfig.current && !status?.authenticated) { setNotice('Connect your GitHub repository in Settings.'); return; }
    if (!navigator.onLine) { setNotice('Offline. Your changes remain on this device.'); return; }
    busy.current = true; setSyncing(true); setError(''); setSyncError('');
    let savingLocally = true;
    try {
      await queue.current;
      savingLocally = false;
      const sent = structuredClone(record.current);
      let result: Awaited<ReturnType<typeof syncGitHub>>;
      if (manualConfig.current) result = await syncGitHub(manualConfig.current, sent.base, sent.snapshot);
      else {
        const response = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: sent.base, snapshot: sent.snapshot }), signal: AbortSignal.timeout(60000) });
        const payload = await response.json();
        if (response.status === 401) setStatus(previous => ({ configured: previous?.configured ?? true, authenticated: false }));
        if (!response.ok && !(response.status === 409 && Array.isArray(payload.conflicts))) throw new Error(payload.error || 'Synchronization is unavailable.');
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
      const next = { snapshot: validateSnapshot(after.snapshot), base: validateSnapshot(result.snapshot), lastSyncedAt: result.lastSyncedAt ?? new Date().toISOString() };
      savingLocally = true;
      await persist(next);
      savingLocally = false;
      setNotice('Your devices are synchronized.');
    } catch (cause) {
      const message = savingLocally ? localSaveFailure : cause instanceof Error ? cause.message : 'Synchronization failed. Your data remains on this device.';
      if (!savingLocally) setSyncError(message);
      setError(message);
    }
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
      setNotice('Another change needs your decision.'); return;
    }
    for (const conflict of conflicts) {
      const collection = current[conflict.collection] as Array<{ id: string }>;
      const chosen = choices[`${conflict.collection}:${conflict.id}`] === 'remote' ? conflict.remote : record.current.snapshot[conflict.collection].find(item => item.id === conflict.id) ?? conflict.local;
      const index = collection.findIndex(item => item.id === conflict.id);
      if (index >= 0) collection.splice(index, 1);
      if (chosen) collection.push(chosen);
    }
    await persist({ ...record.current, snapshot: validateSnapshot(current), base: validateSnapshot(pending.remote) });
    conflictData.current = null; setConflicts([]); setNotice('Selected versions saved. Synchronize to send them to GitHub.');
  }, [conflicts, persist]);

  const dirty = !!record.current && JSON.stringify(data) !== JSON.stringify(record.current.base);
  const connectionStatus: Status | null = manualRepository ? { configured: true, authenticated: true } : status;
  return { data, ready, saving, syncing, status: connectionStatus, serverStatus: status, error, setError, localSaveError, syncError, notice, setNotice, lastSyncedAt, dirty, conflicts, update, sync, resolve, manualRepository, connectGitHub, disconnectGitHub };
}
