import assert from 'node:assert/strict';
import test from 'node:test';
import { dictionaryShard, dictionaryWord, type DictionaryEntry } from '../lib/conversation-dictionary';
import { conversationCardDraft, readConversationWords } from '../lib/conversation-words';
import { readConversation, recentConversation } from '../lib/conversation';

const go: DictionaryEntry = { id: 'go', kanji: ['行く'], readings: ['いく', 'ゆく'], language: 'fre', senses: [{ pos: ['v5k-s'], gloss: ['aller', 'se rendre'] }] };
const word = dictionaryWord({ text: '行き', lemma: '行く', reading: 'イキ', partOfSpeech: '動詞' }, [go]);

test('inflected words keep the visible surface and use the dictionary form for a new card', () => {
  assert.equal(word.text, '行き');
  assert.equal(word.lemma, '行く');
  assert.equal(word.reading, 'いき');
  assert.equal(word.dictionaryReading, 'いく');
  assert.equal(word.language, 'fr');
  const draft = conversationCardDraft(word, '京都に行きました。');
  assert.equal(draft.japanese, '行く');
  assert.equal(draft.reading, 'いく');
  assert.equal(draft.meaning, 'aller ; se rendre');
  assert.equal(draft.example, '京都に行きました。');
});

test('particle lookup distinguishes same-reading nouns and labels English fallback', () => {
  const tooth: DictionaryEntry = { id: 'tooth', kanji: ['歯'], readings: ['は'], language: 'fre', senses: [{ pos: ['n'], gloss: ['dent'] }] };
  const particle: DictionaryEntry = { id: 'topic', kanji: [], readings: ['は'], language: 'eng', senses: [{ pos: ['prt'], gloss: ['marks the topic of a sentence'] }] };
  const result = dictionaryWord({ text: 'は', lemma: 'は', reading: 'ハ', partOfSpeech: '助詞' }, [tooth, particle]);
  assert.equal(result.language, 'en');
  assert.deepEqual(result.definitions, particle.senses[0].gloss);
  assert.equal(result.partOfSpeech, 'particule');
  assert.deepEqual(dictionaryWord({ text: 'た', lemma: 'た', reading: 'タ', partOfSpeech: '助動詞' }, [{ ...tooth, id: 'multi', kanji: ['多'], readings: ['た'], senses: [{ pos: ['n', 'pref'], gloss: ['multi-'] }] }]).definitions, []);
});

test('unknown words do not fabricate a translation and remain editable card drafts', () => {
  const unknown = dictionaryWord({ text: '未知語', lemma: '未知語' }, []);
  assert.deepEqual(unknown.definitions, []);
  assert.equal(unknown.source, null);
  assert.equal(conversationCardDraft(unknown, '未知語です。').meaning, '');
  const homophone: DictionaryEntry = { id: 'bridge', kanji: ['橋'], readings: ['はし'], language: 'fre', senses: [{ pos: ['n'], gloss: ['pont'] }] };
  assert.deepEqual(dictionaryWord({ text: '未知橋', lemma: '未知橋', reading: 'ハシ', partOfSpeech: '名詞' }, [homophone]).definitions, []);
});

test('annotation persistence requires exact lossless sentence reconstruction', () => {
  const punctuation = dictionaryWord({ text: '。' }, []);
  const words = [word, punctuation];
  assert.deepEqual(readConversationWords(words, '行き。'), words);
  assert.equal(readConversationWords(words, '行く。'), undefined);
  assert.equal(readConversationWords([{ ...word, definitions: ['x'.repeat(301)] }], '行き'), undefined);
  assert.equal(readConversationWords([{ ...word, source: 'made-up' }], '行き'), undefined);
  const message = { id: 'a', role: 'assistant', content: '行き。', createdAt: '2026-11-15T10:00:00Z', words };
  const stored = readConversation([message]);
  assert.deepEqual(stored[0].words, words);
  assert.equal(JSON.stringify(recentConversation(stored)).includes('aller'), false);
  assert.equal(readConversation([{ ...message, words: [word] }])[0].words, undefined);
});

test('dictionary partitioning covers Japanese and supplementary Unicode deterministically', () => {
  for (const value of ['日本', 'は', '行く', '𠮷']) {
    const id = dictionaryShard(value);
    assert.match(id, /^[0-3][0-9a-f]$/);
    assert.equal(dictionaryShard(value), id);
  }
});
