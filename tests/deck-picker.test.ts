import test from 'node:test';
import assert from 'node:assert/strict';
import type { Deck } from '../lib/model';
import { deckOptions, suggestDecks } from '../lib/deck-picker';

const deck = (id: string, name: string, parentId: string | null = null): Deck => ({ id, name, parentId, color: 'sage', description: '', updatedAt: '2026-11-15T10:00:00.000Z' });

test('deck search supports child names, ancestor paths, accents and approximate input', () => {
  const options = deckOptions([deck('root', 'Vocabulaire'), deck('fruits', 'Fruits', 'root'), deck('verbs', 'Passé composé')]);
  for (const query of ['fruit', 'fruts', 'Vocabulaire/Fruits', 'vocab fruits']) assert.equal(suggestDecks(options, [], query)[0]?.id, 'fruits', query);
  assert.equal(suggestDecks(options, [], 'passe')[0]?.id, 'verbs');
  assert.equal(options.find(option => option.id === 'fruits')?.path, 'Vocabulaire / Fruits');
});

test('selection is excluded by stable ID, including identically named decks in separate branches', () => {
  const options = deckOptions([deck('a', 'School'), deck('b', 'Work'), deck('one', 'Words', 'a'), deck('two', 'Words', 'b'), deck('three', 'Words', 'a')]);
  assert.deepEqual(suggestDecks(options, ['one'], 'words').map(option => option.id), ['three', 'two']);
  assert.deepEqual(suggestDecks(options, ['one', 'two', 'three'], 'words'), []);
});

test('large deck libraries return a bounded list and deleted decks stay hidden', () => {
  const options = deckOptions([...Array.from({ length: 200 }, (_, index) => deck(`d${index}`, `Deck ${index}`)), { ...deck('deleted', 'Deck deleted'), deletedAt: '2026-11-15T11:00:00.000Z' }]);
  assert.equal(options.length, 200);
  assert.equal(suggestDecks(options, [], '').length, 6);
  assert.equal(suggestDecks(options, [], 'Deck 199')[0]?.id, 'd199');
  assert.deepEqual(suggestDecks(options, [], 'xxxxxxxxxxxxxxxx'), []);
  assert.deepEqual(suggestDecks(options, [], '', 0), []);
});

test('path construction tolerates missing/deleted parents and cycles without changing input', () => {
  const data = [deck('a', 'A', 'b'), deck('b', 'B', 'a'), { ...deck('old', 'Old'), deletedAt: '2026-11-15T11:00:00.000Z' }, deck('child', 'Child', 'old'), deck('orphan', 'Orphan', 'missing')];
  const before = JSON.stringify(data);
  const options = deckOptions(data);
  assert.equal(options.find(option => option.id === 'child')?.path, 'Child');
  assert.equal(options.find(option => option.id === 'orphan')?.path, 'Orphan');
  assert.equal(options.length, 4);
  assert.equal(JSON.stringify(data), before);
});
