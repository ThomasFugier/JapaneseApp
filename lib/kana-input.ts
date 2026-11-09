import { toHiragana, toKatakana } from 'wanakana';

export type WritingInputMode = 'hiragana' | 'katakana';
export type KanaComposition = {
  start: number;
  end: number;
  romaji: string;
  mode: WritingInputMode;
};
type InputResult = { text: string; caret: number; composition: KanaComposition | null };

function kana(romaji: string, mode: KanaComposition['mode'], final = false): string {
  // Keep the roman source while typing: konn → こん, then konni → こんに.
  // WanaKana's stock IME mode consumes both n's and would produce こんい.
  const pendingN = !final && /(^|[^n])n$/i.test(romaji);
  const source = romaji.replace(/nn(?=[^a-z'-]|$)/gi, 'n');
  const value = pendingN ? source.slice(0, -1) : source;
  return (mode === 'katakana' ? toKatakana(value) : toHiragana(value)) + (pendingN ? romaji.slice(-1) : '');
}

function validComposition(text: string, composition: KanaComposition | null): composition is KanaComposition {
  return !!composition && composition.start >= 0 && composition.end <= text.length
    && text.slice(composition.start, composition.end) === kana(composition.romaji, composition.mode);
}

/** Convert only fresh typing. Existing text, paste, deletion and native IME stay intact. */
export function convertWritingInput(
  previous: string, value: string, caret: number, mode: WritingInputMode,
  inputType = 'insertText', composition: KanaComposition | null = null,
): InputResult {
  const unchanged: InputResult = { text: value, caret, composition: null };
  if (!['insertText', 'insertReplacementText', 'insertLineBreak', 'insertParagraph'].includes(inputType)
    || caret < 0 || caret > value.length || value === previous) return unchanged;
  let start = 0;
  while (start < previous.length && start < value.length && previous[start] === value[start]) start++;
  // A changed emoji can share its first UTF-16 code unit.
  if (start > 0 && /[\uD800-\uDBFF]/.test(value[start - 1])) start--;
  let oldEnd = previous.length, end = value.length;
  while (oldEnd > start && end > start && previous[oldEnd - 1] === value[end - 1]) { oldEnd--; end--; }
  const inserted = value.slice(start, end);
  if (!inserted || !/^[\x00-\x7f]+$/.test(inserted) || caret !== end) return unchanged;
  let romaji = inserted;
  if (validComposition(previous, composition) && composition.mode === mode && start === composition.end && oldEnd === start) {
    start = composition.start;
    romaji = composition.romaji + inserted;
  }
  const converted = kana(romaji, mode);
  const next = value.slice(0, start) + converted + value.slice(end);
  const nextCaret = start + converted.length;
  return {
    text: next, caret: nextCaret,
    composition: /^[a-z'-]+$/i.test(romaji) && romaji.length <= 1000
      ? { start, end: nextCaret, romaji, mode } : null,
  };
}

/** Commit a final n when the user leaves the word, without rewriting the page. */
export function finishKanaInput(text: string, composition: KanaComposition | null): { text: string; caret: number } | null {
  if (!validComposition(text, composition)) return null;
  const word = kana(composition.romaji, composition.mode, true);
  return { text: text.slice(0, composition.start) + word + text.slice(composition.end), caret: composition.start + word.length };
}
