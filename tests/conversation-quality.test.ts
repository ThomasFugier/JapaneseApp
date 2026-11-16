import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { contextualReadings } from '../lib/contextual-readings';
import { readConversationWords } from '../lib/conversation-words';
import { dictionaryWord } from '../lib/conversation-dictionary';
import { reviewConversationReply } from '../lib/conversation-review';
import { ConversationResponseError, type ConversationMessage } from '../lib/conversation';

type KuromojiToken = { surface_form: string; reading?: string; basic_form: string; pos: string };
const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');
const tokenizer = new Promise<{ tokenize: (text: string) => KuromojiToken[] }>((resolve, reject) => {
  kuromoji.builder({ dicPath: fileURLToPath(new URL('../node_modules/kuromoji/dict/', import.meta.url)) }).build((error: Error | null, value: { tokenize: (text: string) => KuromojiToken[] }) => error ? reject(error) : resolve(value));
});

test('real tokenizer readings prefer hoka in context without altering compounds or daisuki', async () => {
  const dictionary = await tokenizer;
  for (const [text, surface, expected] of [
    ['他の人にも飲ませてあげたいです。', '他', 'ほか'],
    ['他にもあります。', '他', 'ほか'],
    ['大好きですね。', '大好き', 'ダイスキ'],
    ['他方', '他方', 'タホウ'],
    ['その他', 'その他', 'ソノタ'],
  ]) {
    const tokens = dictionary.tokenize(text).map(token => ({ text: token.surface_form, reading: token.reading, lemma: token.basic_form, partOfSpeech: token.pos }));
    const corrected = contextualReadings(tokens);
    assert.equal(corrected.map(token => token.text).join(''), text);
    assert.equal(corrected.find(token => token.text === surface)?.reading, expected);
  }
});

test('saved annotations are corrected as well as new tokenizer results', () => {
  const tokens = [{ text: '他', reading: 'タ' }, { text: 'の', reading: 'ノ' }, { text: '人', reading: 'ヒト' }];
  const saved = tokens.map(token => dictionaryWord(token, []));
  const result = readConversationWords(saved, '他の人');
  assert.equal(result?.[0].reading, 'ほか');
  assert.equal(result?.[0].dictionaryReading, 'ほか');
  assert.equal(saved[0].reading, 'た');
  assert.deepEqual(contextualReadings(result!), result);
});

const history: ConversationMessage[] = [{ id: 'u', role: 'user', content: 'れもんのおちゃです', createdAt: '2026-11-16T10:00:00Z' }];

test('even all-Japanese drafts pass through the reviewer before becoming a reply', async () => {
  let calls = 0;
  const result = await reviewConversationReply('れもんのお茶は、甘い味です。', history, async messages => {
    calls++;
    assert.match(messages[0].content, /校正者/);
    const data = JSON.parse(messages[1].content);
    assert.equal(data.conversation.at(-1).content, history[0].content);
    assert.equal(data.draft, 'れもんのお茶は、甘い味です。');
    return '<think></think>レモンのお茶ですね。甘いですか？';
  });
  assert.equal(calls, 1);
  assert.equal(result, 'レモンのお茶ですね。甘いですか？');
});

test('failed proofreading never falls back to the unreviewed draft', async () => {
  for (const invalid of ['', 'Bonjour !', 'お茶 means tea.']) {
    await assert.rejects(reviewConversationReply('お茶です。', history, async () => invalid), ConversationResponseError);
  }
  await assert.rejects(reviewConversationReply('お茶です。', history, async () => { throw Error('model failure'); }), /model failure/);
  const repeated: ConversationMessage[] = [{ id: 'a', role: 'assistant', content: 'お茶です。', createdAt: history[0].createdAt }, ...history];
  await assert.rejects(reviewConversationReply('お茶です。', repeated, async () => 'お茶です。'), ConversationResponseError);
});
