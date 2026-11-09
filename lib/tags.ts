import { editDistance } from './japanese-search';
import type { Note } from './model';

export function tagKey(value: string): string {
  return value.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}

export function registeredTags(notes: Pick<Note, 'tags' | 'deletedAt'>[]): string[] {
  const tags = new Map<string, { label: string; count: number }>();
  for (const note of notes) {
    if (note.deletedAt) continue;
    const counted = new Set<string>();
    for (const label of note.tags) {
      const key = tagKey(label);
      if (!key || counted.has(key)) continue;
      counted.add(key);
      const entry = tags.get(key);
      if (entry) entry.count++; else tags.set(key, { label: label.trim(), count: 1 });
    }
  }
  return [...tags.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en')).map(tag => tag.label);
}

export function suggestTags(available: string[], selected: string[], query: string, limit = 6): string[] {
  const key = tagKey(query), excluded = new Set(selected.map(tagKey));
  return available.map((label, index) => {
    const candidate = tagKey(label);
    let rank = Infinity;
    if (!key || candidate === key) rank = 0;
    else if (candidate.startsWith(key)) rank = 1;
    else if (candidate.includes(key)) rank = 2;
    else if (key.length >= 3) {
      const distance = Math.min(editDistance(candidate, key), editDistance(candidate.slice(0, key.length), key));
      if (distance <= (key.length < 6 ? 1 : 2)) rank = 10 + distance;
    }
    return { label, index, rank: excluded.has(candidate) ? Infinity : rank };
  }).filter(tag => Number.isFinite(tag.rank)).sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, limit).map(tag => tag.label);
}

export function appendTag(selected: string[], input: string, available: string[]): string[] {
  const label = input.replace(/\s+/gu, ' ').trim(), key = tagKey(label);
  if (!key || selected.some(tag => tagKey(tag) === key)) return [...selected];
  const existing = available.find(tag => tagKey(tag) === key);
  const value = existing ?? label;
  if (value.length > 80) throw new Error('A tag can contain up to 80 characters.');
  if (selected.length >= 30) throw new Error('A note can have up to 30 tags.');
  return [...selected, value];
}
