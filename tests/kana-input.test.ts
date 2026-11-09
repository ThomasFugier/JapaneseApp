import test from 'node:test';
import assert from 'node:assert/strict';
import { convertWritingInput, finishKanaInput, type KanaComposition, type WritingInputMode } from '../lib/kana-input';

function type(roman: string, mode: WritingInputMode = 'hiragana', initial = '', caret = initial.length) {
  let state = { text: initial, caret, composition: null as KanaComposition | null };
  const frames: string[] = [];
  for (const character of roman) {
    const value = state.text.slice(0, state.caret) + character + state.text.slice(state.caret);
    state = convertWritingInput(state.text, value, state.caret + character.length, mode, 'insertText', state.composition);
    frames.push(state.text);
  }
  return { ...state, frames };
}

test('romaji converts during typing with pending consonants and correct double n', () => {
  assert.deepEqual(type('ringo').frames, ['r', 'り', 'りn', 'りんg', 'りんご']);
  assert.deepEqual(type('konni').frames, ['k', 'こ', 'こn', 'こん', 'こんに']);
  for (const [roman, kana] of [['konnichiha', 'こんにちは'], ['konnyaku', 'こんにゃく'], ['kanpai', 'かんぱい'], ['gakkou', 'がっこう'], ['shin\'you', 'しんよう']]) {
    assert.equal(type(roman).text, kana, roman);
  }
});

test('Japanese punctuation and word boundaries commit the final n', () => {
  assert.equal(type('ringo, taberu.!?').text, 'りんご、 たべる。！？');
  assert.equal(type('kan.').text, 'かん。');
  assert.equal(type('kan\n').text, 'かん\n');
  assert.equal(type('konn.').text, 'こん。');
  const pending = type('kan');
  assert.equal(pending.text, 'かn');
  assert.deepEqual(finishKanaInput(pending.text, pending.composition), { text: 'かん', caret: 2 });
  const double = type('nn');
  assert.equal(finishKanaInput(double.text, double.composition)?.text, 'ん');
});

test('katakana and Latin modes keep their own script', () => {
  assert.equal(type('RINGO').text, 'りんご');
  assert.equal(type('ko-hi-.', 'katakana').text, 'コーヒー。');
  assert.equal(type('Bonjour, ringo.', 'latin').text, 'Bonjour, ringo.');
});

test('insertion and selected-text replacement preserve surrounding Japanese and emoji', () => {
  assert.equal(type('ringo', 'hiragana', '私はを食べる。', 2).text, '私はりんごを食べる。');
  assert.deepEqual(convertWritingInput('🍎 肉です。', '🍎 kaです。', 5, 'hiragana'), {
    text: '🍎 かです。', caret: 4, composition: { start: 3, end: 4, romaji: 'ka', mode: 'hiragana' },
  });
  assert.equal(type('taberu.', 'hiragana', '🍎 ').text, '🍎 たべる。');
});

test('native IME, paste, undo and deletion preserve their exact text', () => {
  for (const inputType of ['insertFromPaste', 'insertFromDrop', 'insertCompositionText', 'historyUndo', 'historyRedo', 'deleteContentBackward']) {
    const value = 'カタカナ, ringo.';
    const result = convertWritingInput('', value, value.length, 'hiragana', inputType);
    assert.equal(result.text, value, inputType);
    assert.equal(result.composition, null);
  }
  assert.equal(convertWritingInput('', 'カタカナ。', 5, 'hiragana').text, 'カタカナ。');
  // A pasted Latin word is not retroactively rewritten by the next keystroke.
  assert.equal(convertWritingInput('bonjour', 'bonjour.', 8, 'hiragana').text, 'bonjour。');
});

test('moving the caret or changing mode cannot reuse an unrelated composition', () => {
  const word = type('ringo');
  assert.equal(convertWritingInput(word.text, 'k' + word.text, 1, 'hiragana', 'insertText', word.composition).text, 'kりんご');
  assert.equal(convertWritingInput(word.text, word.text + 'ka', word.caret + 2, 'katakana', 'insertText', word.composition).text, 'りんごカ');
  assert.equal(finishKanaInput('autre texte', word.composition), null);
});
