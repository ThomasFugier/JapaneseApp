import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanConversationReply, conversationHelp, conversationHelpInstruction, conversationPrompt, hasJapaneseReply, isJapaneseMessage, readConversation, recentConversation, repeatsConversationReply, type ConversationMessage } from '../lib/conversation';

const at = '2026-11-15T10:00:00.000Z';
const turn = (role: ConversationMessage['role'], content: string, id = content): ConversationMessage => ({ id, role, content, createdAt: at });

test('requests for understanding retain the actual phrase and escalate after another failed explanation', () => {
  const history = [turn('assistant', 'おやつは食べましたか？'), turn('user', 'わかりません')];
  assert.deepEqual(conversationHelp(history), { attempts: 1, previous: 'おやつは食べましたか？' });
  history.push(turn('assistant', 'おやつは、小さい食べ物です。'), turn('user', 'すみません、まだ分かりません。'));
  assert.equal(conversationHelp(history)?.attempts, 2);
  assert.match(conversationHelpInstruction(history), /前の説明でも伝わりませんでした/);
  assert.match(conversationHelpInstruction(history), /おやつは、小さい食べ物です/);
  history.push(turn('assistant', 'いちごは好きですか？'), turn('user', 'はい、好きです。'));
  assert.equal(conversationHelp(history), null);
  history.push(turn('assistant', '甘いですね。'), turn('user', 'もっとやさしい日本語でお願いします。'));
  assert.equal(conversationHelp(history)?.attempts, 1);
});

test('ordinary answers are not treated as requests to explain', () => {
  for (const content of ['いちごが好きですか', '明日の天気はわかりません', '食べません', 'はい']) {
    assert.equal(conversationHelp([turn('assistant', '明日は何をしますか？'), turn('user', content)]), null);
  }
  for (const content of ['わからない', 'よくわかりません', 'どういう意味？', 'もう一度お願いします', 'やさしい日本語で説明してください。']) {
    assert.equal(conversationHelp([turn('assistant', 'おやつです。'), turn('user', content)])?.attempts, 1);
  }
});

test('repeated replies and bare repeated questions trigger regeneration while explanations are allowed', () => {
  const history = [turn('assistant', 'そうですね。おやつは食べましたか？'), turn('user', 'わかりません')];
  assert.equal(repeatsConversationReply('そうですね！ おやつは食べましたか。', history), true);
  assert.equal(repeatsConversationReply('おやつは食べましたか？', history), true);
  assert.equal(repeatsConversationReply('そうなんですね。おやつは食べましたか？', history), true);
  assert.equal(repeatsConversationReply('おやつは、ご飯とご飯の間に食べるものです。たとえば、いちごです。', history), false);
  assert.equal(repeatsConversationReply('こんにちは。', []), false);
  const prompt = conversationPrompt(history);
  assert.match(prompt, /説明の対象/);
  assert.match(prompt, /質問なしでもいい/);
});
test('general conversation has no card vocabulary or validated-lesson restrictions', () => {
  const prompt = conversationPrompt([turn('user', '日本の旅行について話したいです。')]);
  assert.match(prompt, /幅広い話題/);
  assert.match(prompt, /条件を守り/);
  assert.doesNotMatch(prompt, /学習データ|承認済み|カードの単語|validated|vocabulary/);
});

test('history preserves the generated question and bounds old context', () => {
  const history = [turn('assistant', '今日は何をしますか。'), turn('user', '仕事です。')];
  const context = recentConversation(history);
  assert.equal(context[0].role, 'user');
  assert.equal(context[1].content, '今日は何をしますか。');
  assert.equal(context.at(-1)?.content, '仕事です。');
  const long = Array.from({ length: 30 }, (_, i) => turn(i % 2 ? 'assistant' : 'user', `${i}${'あ'.repeat(200)}`));
  assert.ok(recentConversation(long).length <= 17);
  assert.equal(recentConversation(long).at(-1)?.content, long.at(-1)?.content);
  const prompt = conversationPrompt(history, new Date(2026, 10, 15, 8));
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
