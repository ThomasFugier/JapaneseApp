import test from 'node:test';
import assert from 'node:assert/strict';
import { appendTag, registeredTags, suggestTags, tagKey } from '../lib/tags';

test('registered tags exclude deleted notes and combine spelling variants by usage', () => {
  const tags = registeredTags([
    { tags: ['noun', 'NOUN', 'food'] }, { tags: ['noun', 'verb'] },
    { tags: ['archived'], deletedAt: '2026-11-09T00:00:00.000Z' },
  ]);
  assert.deepEqual(tags, ['noun', 'food', 'verb']);
});

test('suggestions prioritize exact, prefix and substring matches and exclude selected tags', () => {
  const available = ['adverb', 'verb', 'verbal', 'noun'];
  assert.deepEqual(suggestTags(available, [], 'VER'), ['verb', 'verbal', 'adverb']);
  assert.deepEqual(suggestTags(available, ['VERB'], 'verb'), ['verbal', 'adverb']);
  assert.deepEqual(suggestTags(available, ['noun'], '', 2), ['adverb', 'verb']);
});

test('tag similarity tolerates substitutions, transpositions and incomplete words', () => {
  for (const query of ['vreb', 'verv', 'ver']) assert.equal(suggestTags(['noun', 'verb', 'adjective'], [], query)[0], 'verb');
  assert.equal(suggestTags(['daily life', 'adjective'], [], 'daliy')[0], 'daily life');
  assert.deepEqual(suggestTags(['noun', 'verb'], [], 'unrelated topic'), []);
});

test('adding a tag reuses saved labels, prevents duplicates and preserves Japanese voiced sounds', () => {
  assert.deepEqual(appendTag([], ' CAFÉ ', ['café']), ['café']);
  assert.deepEqual(appendTag(['noun'], 'ＮＯＵＮ', ['noun']), ['noun']);
  assert.deepEqual(appendTag(['noun'], '  daily   life  ', []), ['noun', 'daily life']);
  assert.deepEqual(appendTag(['noun'], ' ', []), ['noun']);
  assert.notEqual(tagKey('が'), tagKey('か'));
});

test('tag creation respects note limits without discarding an existing selection', () => {
  const selected = Array.from({ length: 30 }, (_, i) => `tag-${i}`);
  assert.throws(() => appendTag(selected, 'extra', []), /30 tags/);
  assert.deepEqual(appendTag(selected, 'TAG-0', []), selected);
  assert.throws(() => appendTag([], 'a'.repeat(81), []), /80 characters/);
  assert.equal(selected.length, 30);
});
