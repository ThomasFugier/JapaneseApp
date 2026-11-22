import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeStoryProgress, storyText } from '../lib/stories';
import { stories } from '../lib/story-catalog';
import { hasKanji, splitFurigana } from '../lib/furigana';
import { readFileSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { parseStoryCatalog } from '../lib/story-catalog';
import { parseStoryDocument, storyDocumentSchema } from '../lib/story-schema';

test('every mini story fits a short page and every word has an offline gloss and reading', () => {
  assert.equal(new Set(stories.map(story => story.id)).size, stories.length);
  assert.ok(stories.length >= 6);
  for (const story of stories) {
    const text = storyText(story);
    assert.ok(text.length >= 80 && text.length <= 250, `${story.id}: ${text.length} characters`);
    assert.ok(!text.includes(' '));
    for (const word of story.paragraphs.flat()) {
      if (typeof word === 'string') { assert.match(word, /^[、。「」！？]+$/); continue; }
      assert.ok(word.meaning.trim(), word.text);
      assert.match(word.reading, /^[ぁ-ゖー]+$/, word.text);
      const parts = splitFurigana(word.text, word.reading);
      assert.equal(parts.map(part => part.text).join(''), word.text);
      assert.ok(parts.every(part => !hasKanji(part.text) || part.reading), `Missing furigana: ${word.text}`);
    }
  }
});

test('the JSON schema provided to generators matches the application validator', () => {
  assert.deepEqual(JSON.parse(readFileSync('content/story.schema.json', 'utf8')), z.toJSONSchema(storyDocumentSchema, { target: 'draft-07' }));
});

test('all JSON files are loaded without a manual registry, with stable order and duplicate checks', () => {
  assert.equal(stories.length, readdirSync('content/stories').filter(file => file.endsWith('.json')).length);
  const document = { schemaVersion: 1, language: 'ja', definitionLanguage: 'fr', ...stories[0] };
  const files = [
    { name: '02-second.json', content: JSON.stringify({ ...document, id: 'new-second-story' }) },
    { name: '01-first.json', content: JSON.stringify({ ...document, id: 'new-first-story' }) },
  ];
  assert.deepEqual(parseStoryCatalog(files).map(story => story.id), ['new-first-story', 'new-second-story']);
  assert.equal(storyText(parseStoryCatalog(files)[0]), storyText(stories[0]));
  assert.throws(() => parseStoryCatalog([...files, { ...files[1], name: '03-duplicate.json' }]), /03-duplicate\.json.*Duplicate story ID/s);
  assert.throws(() => parseStoryCatalog([{ name: 'broken.json', content: '{' }]), /Invalid story broken\.json/);
});

test('generated content rejects unsupported versions, covers and words without definitions', () => {
  const document = { schemaVersion: 1, language: 'ja', definitionLanguage: 'fr', ...stories[0] };
  assert.throws(() => parseStoryDocument({ ...document, schemaVersion: 2 }));
  assert.throws(() => parseStoryDocument({ ...document, theme: 'missing-cover' }));
  assert.throws(() => parseStoryDocument({ ...document, paragraphs: [[{ text: '猫', reading: 'ねこ' }]] }));
  assert.throws(() => parseStoryDocument({ ...document, paragraphs: [['猫']] }));
  assert.throws(() => parseStoryDocument({ ...document, paragraphs: [[{ text: '猫', reading: 'neko', meaning: 'Un chat.' }]] }));
});

test('local reading history rejects stale IDs, duplicates and malformed saved values', () => {
  const id = stories[0].id;
  assert.deepEqual(sanitizeStoryProgress({ currentId: id, readIds: [id, 'removed-story', id, null, {}] }, stories), { currentId: id, readIds: [id] });
  for (const input of [null, [], 'bad JSON value', { currentId: 4, readIds: 'not-an-array' }, { currentId: 'removed-story' }]) {
    assert.deepEqual(sanitizeStoryProgress(input, stories), { currentId: null, readIds: [] });
  }
});
