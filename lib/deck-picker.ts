import type { Deck } from './model';
import { editDistance } from './japanese-search';
import { tagKey } from './tags';

export type DeckOption = { id: string; name: string; path: string; color: Deck['color'] };
const order = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const searchKey = (value: string) => tagKey(value).replace(/\s*[/／]\s*/gu, ' ');

export function deckOptions(decks: readonly Deck[]): DeckOption[] {
  const byId = new Map(decks.map(deck => [deck.id, deck]));
  return decks.filter(deck => !deck.deletedAt).map(deck => {
    const names: string[] = [];
    const seen = new Set<string>();
    let current: Deck | undefined = deck;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (!current.deletedAt) names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return { id: deck.id, name: deck.name, path: names.join(' / '), color: deck.color };
  }).sort((a, b) => order.compare(a.path, b.path) || a.id.localeCompare(b.id));
}

export function suggestDecks(options: readonly DeckOption[], selectedIds: readonly string[], query: string, limit = 6): DeckOption[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const key = searchKey(query);
  const words = key.split(/\s+/u).filter(Boolean);
  const selected = new Set(selectedIds);
  return options.flatMap(option => {
    if (selected.has(option.id)) return [];
    const name = searchKey(option.name), path = searchKey(option.path);
    let rank = Infinity;
    if (!key || name === key || path === key) rank = 0;
    else if (name.startsWith(key)) rank = 1;
    else if (path.includes(key)) rank = 2;
    else if (words.every(word => path.includes(word))) rank = 3;
    else if (key.length >= 3 && key.length <= 80) {
      const distance = Math.min(editDistance(name, key), editDistance(name.slice(0, key.length), key));
      if (distance <= (key.length < 6 ? 1 : 2)) rank = 10 + distance;
    }
    return Number.isFinite(rank) ? [{ option, rank }] : [];
  }).sort((a, b) => a.rank - b.rank || order.compare(a.option.path, b.option.path) || a.option.id.localeCompare(b.option.id))
    .slice(0, Math.min(8, Math.floor(limit))).map(item => item.option);
}
