import { CURRENT_SCHEMA_VERSION, validateSnapshot } from '../model';
import { HttpError } from './http';

/** Old tabs must reload instead of dropping saved review deadlines. */
export function parseSyncInput(body: unknown) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid library format. No remote data was changed.');
  const input = body as { base?: unknown; snapshot?: unknown };
  const version = input.snapshot && typeof input.snapshot === 'object' ? (input.snapshot as { schemaVersion?: unknown }).schemaVersion : undefined;
  if (typeof version === 'number' && version < CURRENT_SCHEMA_VERSION && version >= 1) throw new HttpError(426, 'The app has been updated. Reload this page to synchronize. Your changes remain saved on this device.');
  try { return { base: validateSnapshot(input.base), snapshot: validateSnapshot(input.snapshot) }; }
  catch { throw new HttpError(400, 'Invalid library format. No remote data was changed.'); }
}
