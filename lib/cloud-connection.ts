import { emptySnapshot, snapshotsEqual, type Snapshot } from './model';
import { isUnmodifiedSample } from './seed';
import type { Conflict } from './merge';
import type { LibraryState } from './storage';

export type CloudConnectionStatus = {
  configured: boolean;
  authenticated: boolean;
  repository: string;
  branch: string;
  user?: { login: string };
  reason?: string;
};

export type CloudSyncResult =
  | { conflict: false; snapshot: Snapshot; revision?: string | null; lastSyncedAt?: string }
  | { conflict: true; snapshot: Snapshot; remote: Snapshot; conflicts: Conflict[] };

/** Never merge untouched demonstration cards into a personal cloud library. */
export function needsCloudBootstrap(status: CloudConnectionStatus | null, stored: LibraryState | null): boolean {
  return !!status?.configured && status.authenticated && (!stored ||
    (isUnmodifiedSample(stored.snapshot) && snapshotsEqual(stored.base, emptySnapshot())));
}
