import { openDB } from 'idb';
import { validateSnapshot, type Snapshot } from './model';

export type LibraryState = { snapshot: Snapshot; base: Snapshot; lastSyncedAt: string | null };
const database = () => openDB('kotoba-library', 1, { upgrade(db) { db.createObjectStore('library'); } });

export async function loadLibrary(): Promise<LibraryState | null> {
  const db = await database();
  try {
    const value = await db.get('library', 'current') as LibraryState | undefined;
    if (!value) return null;
    return { snapshot: validateSnapshot(value.snapshot), base: validateSnapshot(value.base), lastSyncedAt: value.lastSyncedAt ?? null };
  } finally { db.close(); }
}

export async function saveLibrary(value: LibraryState): Promise<void> {
  const db = await database();
  try {
    const tx = db.transaction('library', 'readwrite');
    await tx.store.put(value, 'current');
    await tx.done;
  } finally { db.close(); }
}
