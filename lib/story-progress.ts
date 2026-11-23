import { validateSnapshot, type Snapshot, type StoryReadProgress } from './model';

export function mergeStoryProgress(...collections: (StoryReadProgress[] | undefined)[]): StoryReadProgress[] {
  const merged = new Map<string, StoryReadProgress>();
  for (const record of collections.flatMap(collection => collection ?? [])) {
    const previous = merged.get(record.id);
    if (!previous) { merged.set(record.id, record); continue; }
    const time = Date.parse(record.updatedAt), previousTime = Date.parse(previous.updatedAt);
    if (time > previousTime || (time === previousTime && (
      (!record.read && previous.read) || (record.read === previous.read && record.updatedAt > previous.updatedAt)
    ))) merged.set(record.id, record);
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function setStoryRead(snapshot: Snapshot, id: string, read: boolean, now = new Date().toISOString()): Snapshot {
  const existing = snapshot.storyProgress?.find(record => record.id === id);
  const updatedAt = existing && Date.parse(now) <= Date.parse(existing.updatedAt)
    ? new Date(Date.parse(existing.updatedAt) + 1).toISOString() : now;
  return validateSnapshot({ ...snapshot, storyProgress: [
    ...(snapshot.storyProgress ?? []).filter(record => record.id !== id), { id, read, updatedAt },
  ] });
}

// Legacy browser flags have no date and must never override a saved read/unread choice.
export function importLegacyStoryReads(snapshot: Snapshot, readIds: readonly string[]): Snapshot {
  const existing = new Set((snapshot.storyProgress ?? []).map(record => record.id));
  const missing = [...new Set(readIds)].filter(id => !existing.has(id));
  if (!missing.length) return snapshot;
  return validateSnapshot({ ...snapshot, storyProgress: [
    ...(snapshot.storyProgress ?? []), ...missing.map(id => ({ id, read: true, updatedAt: '1970-01-01T00:00:00.000Z' })),
  ] });
}
