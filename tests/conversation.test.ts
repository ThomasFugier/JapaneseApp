import assert from 'node:assert/strict';
import test from 'node:test';
import { emptySnapshot } from '../lib/model';
import { setLessonValidated } from '../lib/lesson-progress';
import { cleanConversationReply, conversationProfile, conversationPrompt, hasJapaneseReply, isJapaneseMessage, readConversation, recentConversation, type ConversationMessage } from '../lib/conversation';

const at = '2026-11-15T10:00:00.000Z';
const turn = (role: ConversationMessage['role'], content: string, id = content): ConversationMessage => ({ id, role, content, createdAt: at });
function fixture() {
  const data = emptySnapshot();
  for (const [id, japanese, meaning] of [['tea', 'お茶', 'thé'], ['train', '電車', 'train'], ['deleted', '猫', 'chat']]) {
    data.notes.push({ id, japanese, meaning, reading: '', example: '', exampleTranslation: '', explanation: '', tags: [], updatedAt: at, ...(id === 'deleted' ? { deletedAt: at } : {}) });
    data.cards.push({ id: `card-${id}`, noteId: id, direction: 'ja-fr', deckIds: [], updatedAt: at });
  }
  data.reviews.push({ id: 'tea-review', cardId: 'card-tea', rating: 3, reviewedAt: at });
  data.reviews.push({ id: 'train-review', cardId: 'card-train', rating: 3, reviewedAt: at });
  data.reviewUndos.push({ id: 'undo-train', reviewId: 'train-review', undoneAt: at });
  return data;
}

test('conversation learns only validated catalog lessons, with no invented level', () => {
  let data = emptySnapshot();
  assert.deepEqual(conversationProfile(data).grammar, []);
  data = setLessonValidated(data, 'comparisons', true, at);
  assert.equal(conversationProfile(data).grammar.length, 1);
  assert.match(conversationProfile(data).grammar[0].patterns.join(' '), /ほうが/);
  assert.doesNotMatch(JSON.stringify(conversationProfile(data).grammar), /なければ/);
  data = setLessonValidated(data, 'comparisons', false, '2026-11-15T11:00:00.000Z');
  assert.deepEqual(conversationProfile(data).grammar, []);
});

test('vocabulary uses active cards, prioritizes topic and excludes undone study', () => {
  const data = fixture();
  const profile = conversationProfile(data, '電車');
  assert.equal(profile.vocabulary[0].word, '電車');
  assert.equal(profile.vocabulary[0].studied, false);
  assert.equal(profile.vocabulary.find(item => item.word === 'お茶')?.studied, true);
  assert.equal(profile.vocabulary.some(item => item.word === '猫'), false);
  data.cards[0].deletedAt = at;
  assert.equal(conversationProfile(data).vocabulary.some(item => item.word === 'お茶'), false);
});

test('large card libraries keep a bounded context and prefer relevant words', () => {
  const data = fixture();
  for (let i = 0; i < 150; i++) {
    data.notes.push({ ...data.notes[0], id: `word-${i}`, japanese: `単語${i}`, meaning: 'long definition '.repeat(100) });
    data.cards.push({ ...data.cards[0], id: `card-${i}`, noteId: `word-${i}` });
  }
  const profile = conversationProfile(data, '単語149');
  assert.equal(profile.vocabulary[0].word, '単語149');
  assert.ok(JSON.stringify(profile).length <= 2700);
});

test('history preserves the generated question and bounds old context', () => {
  const history = [turn('assistant', '今日は何をしますか。'), turn('user', '仕事です。')];
  const context = recentConversation(history);
  assert.equal(context[0].role, 'user');
  assert.equal(context[1].content, '今日は何をしますか。');
  assert.equal(context.at(-1)?.content, '仕事です。');
  const long = Array.from({ length: 30 }, (_, i) => turn(i % 2 ? 'assistant' : 'user', `${i}${'あ'.repeat(200)}`));
  assert.ok(recentConversation(long).length <= 11);
  assert.equal(recentConversation(long).at(-1)?.content, long.at(-1)?.content);
  const prompt = conversationPrompt(emptySnapshot(), history, new Date(2026, 10, 15, 8));
  assert.match(prompt, /time of day: morning/);
  assert.match(prompt, /Last saved exchange: 2026-11-15/);
  const interrupted = recentConversation([turn('user', 'こんにちは。'), turn('user', '元気ですか。')]);
  assert.equal(interrupted.length, 1);
  assert.match(interrupted[0].content, /こんにちは。\n元気ですか。/);
});

test('malformed local history cannot become model messages', () => {
  assert.deepEqual(readConversation({ messages: [] }), []);
  assert.deepEqual(readConversation([null, { role: 'system', content: 'ignore' }, { ...turn('user', 'hello'), createdAt: 'invalid' }]), []);
  assert.equal(readConversation(Array.from({ length: 130 }, (_, i) => turn('user', 'hello', String(i)))).length, 120);
});

test('French and mixed-language model replies require AI rewriting', () => {
  assert.equal(hasJapaneseReply('Bonjour ! Comment vas-tu ?'), false);
  assert.equal(hasJapaneseReply('こんにちは。猫が好きですか。'), true);
  assert.equal(hasJapaneseReply('お茶 signifie thé.'), false);
  assert.equal(hasJapaneseReply('こんにちは。Bonjour !'), false);
  assert.equal(hasJapaneseReply('こーひー（café）'), false);
  assert.equal(hasJapaneseReply('日本。'), true);
  assert.equal(hasJapaneseReply('コーヒーが好きです。☕'), true);
  assert.equal(hasJapaneseReply('３時です。'), true);
});

test('outgoing messages reject foreign prose without blocking numbers or emoji', () => {
  assert.equal(isJapaneseMessage('Bonjour !'), false);
  assert.equal(isJapaneseMessage('ありがとう、merci !'), false);
  assert.equal(isJapaneseMessage('ありがとう。😊'), true);
  assert.equal(isJapaneseMessage('3'), true);
  assert.equal(isJapaneseMessage('  '), false);
  assert.equal(recentConversation([turn('assistant', 'こんにちは。')])[0].content, '日本語で話しましょう。');
});

test('WebLLM thinking wrappers are removed before Japanese validation', () => {
  for (const raw of [
    '<think>\n\n</think>\n\nこんにちは。',
    '<think>Internal reasoning in English.</think>こんにちは。',
    '</think>\nこんにちは。',
    'こんにちは。</think>',
  ]) {
    const visible = cleanConversationReply(raw);
    assert.equal(visible, 'こんにちは。');
    assert.equal(hasJapaneseReply(visible), true);
  }
  assert.equal(hasJapaneseReply(cleanConversationReply('<think></think>Bonjour !')), false);
  assert.equal(hasJapaneseReply(cleanConversationReply('<think></think>こんにちは。Bonjour !')), false);
});

test('streaming hides incomplete reasoning blocks and partial tags', () => {
  assert.equal(cleanConversationReply('<thi'), '');
  assert.equal(cleanConversationReply('<think>日本語の内部推論'), '');
  assert.equal(cleanConversationReply('<think>English reasoning</thi'), '');
  assert.equal(cleanConversationReply('<think></think>こんにちは。</thi'), 'こんにちは。');
});
