import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { contextualReadings } from '../lib/contextual-readings';

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

