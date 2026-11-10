'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptySnapshot, snapshotsEqual, validateSnapshot, type Snapshot } from '@/lib/model';
import { loadLibrary, saveLibrary } from '@/lib/storage';
import { mergeSnapshots, type Conflict } from '@/lib/merge';
import { forgetGitHubConnection } from '@/lib/github-connection-store';
import { needsCloudBootstrap, type CloudConnectionStatus as Status, type CloudSyncResult } from '@/lib/cloud-connection';

type Library = { snapshot: Snapshot; base: Snapshot; lastSyncedAt: string | null };
const localSaveFailure = 'Local save failed. Your last action was not saved. Export your data and check the available storage space.';

async function fetchCloudStatus(): Promise<Status> {
  const response = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Connection status is temporarily unavailable.');
  return response.json();
}

export function useLibrary() {
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [localSaveError, setLocalSaveError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
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
        try { remoteStatus = await fetchCloudStatus(); } catch { /* Offline mode. */ }
        if (disposed) return;
        setStatus(remoteStatus);
        if (remoteStatus?.authenticated) {
          try { forgetGitHubConnection(); } catch { /* Legacy browser credentials are never used for cloud access. */ }
        }
        let value: Library = stored ?? { snapshot: emptySnapshot(), base: emptySnapshot(), lastSyncedAt: null };
        let loadedCloud = false;
        if (needsCloudBootstrap(remoteStatus, stored)) {
          loadingRemote = true;
          try {
            const response = await fetch('/api/sync', { cache: 'no-store', signal: AbortSignal.timeout(45000) });
            const remote = await response.json();
            if (!response.ok) throw new Error(remote.error || 'Unable to load your cloud library.');
            const snapshot = validateSnapshot(remote.snapshot);
            value = { snapshot, base: snapshot, lastSyncedAt: new Date().toISOString() };
            loadedCloud = true;
          } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Cloud synchronization is unavailable. Your local data is preserved.';
            setSyncError(message); setError(message);
            if (stored) value = stored;
          }
          loadingRemote = false;
        }
        if (disposed) return;
        if (!stored || loadedCloud) {
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
        if (auth === 'success') setNotice('Account connected.');
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
      setOnline(navigator.onLine);
      if (!navigator.onLine) return;
      void fetchCloudStatus().then(next => {
        setStatus(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      }).catch(() => undefined);
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshStatus(); };
    refreshStatus();
    window.addEventListener('online', refreshStatus); window.addEventListener('focus', refreshStatus);
    window.addEventListener('offline', onOffline); document.addEventListener('visibilitychange', onVisible);
    // A page opened offline may regain Internet access without an online event.
    const retry = status === null ? window.setInterval(() => { if (!document.hidden) refreshStatus(); }, 30000) : undefined;
    return () => {
      window.removeEventListener('online', refreshStatus); window.removeEventListener('focus', refreshStatus);
      window.removeEventListener('offline', onOffline); document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(retry);
    };
  }, [ready, status]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (saving) event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [saving]);

  const update = useCallback((fn: (snapshot: Snapshot) => Snapshot) => {
    if (!record.current) return Promise.resolve();
    return persist({ ...record.current, snapshot: fn(structuredClone(record.current.snapshot)) });
  }, [persist]);

  const disconnectGitHub = useCallback(async () => {
    if (busy.current) throw new Error('Wait for synchronization to finish.');
    busy.current = true;
    try {
      await queue.current;
      const response = await fetch('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Unable to sign out. Try again.');
      setStatus(previous => previous ? { ...previous, authenticated: false, user: undefined } : null);
      try { forgetGitHubConnection(); } catch { /* Cloud access does not depend on browser credentials. */ }
      setSyncError(''); setError('');
      setNotice('Signed out. Your local cards are preserved.');
    } finally { busy.current = false; }
  }, []);

  const sync = useCallback(async () => {
    if (!record.current || busy.current || conflictData.current) return;
    if (!navigator.onLine) return;
    if (!status?.authenticated) { setNotice('Connect your account to synchronize.'); return; }
    busy.current = true; setSyncing(true); setError(''); setSyncError('');
    let savingLocally = true;
    try {
      await queue.current;
      savingLocally = false;
      const sent = structuredClone(record.current);
      // Retrying a failed first load must never upload untouched demo cards.
      if (needsCloudBootstrap(status, sent)) {
        const response = await fetch('/api/sync', { cache: 'no-store', signal: AbortSignal.timeout(45000) });
        const remote = await response.json();
        if (response.status === 401) setStatus(previous => previous ? { ...previous, authenticated: false, user: undefined } : null);
        if (!response.ok) throw new Error(remote.error || 'Unable to load your cloud library.');
        if (!needsCloudBootstrap(status, record.current)) return;
        const snapshot = validateSnapshot(remote.snapshot);
        savingLocally = true;
        await persist({ snapshot, base: snapshot, lastSyncedAt: new Date().toISOString() });
        savingLocally = false;
        return;
      }
      const response = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: sent.base, snapshot: sent.snapshot }), signal: AbortSignal.timeout(60000) });
      const payload = await response.json();
      if (response.status === 401) setStatus(previous => previous ? { ...previous, authenticated: false, user: undefined } : null);
      if (!response.ok && !(response.status === 409 && Array.isArray(payload.conflicts))) throw new Error(payload.error || 'Synchronization is unavailable.');
      const result: CloudSyncResult = { ...payload, conflict: response.status === 409 };
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
    } catch (cause) {
      if (!savingLocally && !navigator.onLine) return;
      const message = savingLocally ? localSaveFailure : cause instanceof Error ? cause.message : 'Synchronization failed. Your data remains on this device.';
      if (!savingLocally) setSyncError(message);
      setError(message);
    }
    finally { busy.current = false; setSyncing(false); }
  }, [persist, status]);

  const base = record.current?.base;
  const dirty = useMemo(() => !!base && JSON.stringify(data) !== JSON.stringify(base), [data, base]);

  useEffect(() => {
    if (!ready || !status?.authenticated || !record.current || JSON.stringify(record.current.snapshot) === JSON.stringify(record.current.base)) return;
    const timer = setTimeout(() => { void sync(); }, 15000);
    return () => clearTimeout(timer);
  }, [data, ready, status, sync]);

  useEffect(() => {
    if (!ready || !status?.authenticated) return;
    void sync();
    const onFocus = () => { void sync(); };
    const onVisible = () => { if (!document.hidden) void sync(); };
    window.addEventListener('online', onFocus); window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onFocus); window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, status, sync]);

  useEffect(() => {
    if (!ready || !status?.authenticated || (!dirty && !syncError) || conflicts.length) return;
    // Retry pending changes even when a failed request did not trigger an online event.
    const retry = window.setInterval(() => { if (navigator.onLine && !document.hidden) void sync(); }, 30000);
    return () => window.clearInterval(retry);
  }, [ready, status, dirty, syncError, conflicts.length, sync]);

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

  return { data, ready, saving, syncing, online, status, error, setError, localSaveError, syncError, notice, setNotice, lastSyncedAt, dirty, conflicts, update, sync, resolve, disconnectGitHub };
}
