import { convertWritingInput, finishKanaInput, type KanaComposition, type WritingInputMode } from './kana-input';
import { applySuggestion, writingMatches, writingToken, type WritingMatch } from './writing';
import type { Note, Snapshot } from './model';

export type EntryRange = { start: number; end: number };
export type JapaneseEntry = { text: string; selection: EntryRange; pending: EntryRange | null; composition: KanaComposition | null };
export const createJapaneseEntry = (text = ''): JapaneseEntry => ({ text, selection: { start: text.length, end: text.length }, pending: null, composition: null });

function changedRange(previous: JapaneseEntry, text: string) {
  let start = 0;
  while (start < previous.selection.start && start < text.length && previous.text[start] === text[start]) start++;
  let oldEnd = previous.text.length, end = text.length;
  while (oldEnd > Math.max(start, previous.selection.end) && end > start && previous.text[oldEnd - 1] === text[end - 1]) { oldEnd--; end--; }
  return { start, oldEnd, end };
}

export function changeJapaneseEntry(previous: JapaneseEntry, raw: string, selection: EntryRange, mode: WritingInputMode | 'latin', inputType = 'insertText', nativeComposing = false): JapaneseEntry {
  const converted = nativeComposing || mode === 'latin' || selection.start !== selection.end
    ? { text: raw, caret: selection.start, composition: null }
    : convertWritingInput(previous.text, raw, selection.start, mode, inputType, previous.composition);
  const nextSelection = converted.text === raw ? selection : { start: converted.caret, end: converted.caret };
  const next: JapaneseEntry = { text: converted.text, selection: nextSelection, pending: null, composition: converted.composition };
  // Clipboard and native-IME confirmation are already committed by their source.
  if (['insertFromPaste', 'insertFromDrop', 'insertFromComposition'].includes(inputType)) return next;
  const edit = changedRange(previous, next.text);
  const pending = previous.pending;
  const inside = pending && edit.start >= pending.start && edit.oldEnd <= pending.end;
  const start = inside ? pending.start : edit.start;
  const end = inside ? pending.end + next.text.length - previous.text.length : edit.end;
  if (end <= start || nextSelection.start !== nextSelection.end || (!inside && edit.end === edit.start)) return next;
  // A delimiter commits everything before it. Never infer a token from older,
  // committed text: only this explicit segment is eligible for autocomplete.
  const token = writingToken(next.text.slice(start, end), end - start);
  if (token) next.pending = { start: start + token.start, end: start + token.end };
  return next;
}

export function commitJapaneseEntry(entry: JapaneseEntry): JapaneseEntry {
  const finished = finishKanaInput(entry.text, entry.composition);
  const text = finished?.text ?? entry.text;
  const delta = text.length - entry.text.length;
  const adjust = (offset: number) => offset >= (entry.composition?.end ?? Infinity) ? offset + delta : offset;
  return { text, selection: { start: adjust(entry.selection.start), end: adjust(entry.selection.end) }, pending: null, composition: null };
}

export function matchJapaneseEntry(data: Snapshot, entry: JapaneseEntry): WritingMatch | null {
  const { pending, selection, text } = entry;
  if (!pending || selection.start !== selection.end || selection.start < pending.start || selection.end > pending.end) return null;
  const match = writingMatches(data, text.slice(pending.start, pending.end), selection.start - pending.start);
  if (!match) return null;
  const shift = (range: WritingMatch['range']) => ({ ...range, start: range.start + pending.start, end: range.end + pending.start });
  return { range: shift(match.range), notes: match.notes, ranges: new Map([...match.ranges].map(([id, range]) => [id, shift(range)])) };
}

export function insertJapaneseEntry(entry: JapaneseEntry, match: WritingMatch, note: Note): JapaneseEntry {
  const range = match.ranges.get(note.id) ?? match.range;
  if (!entry.pending || range.start < entry.pending.start || range.end > entry.pending.end) throw Error('The active entry has changed.');
  const next = applySuggestion(entry.text, range, note.japanese);
  return { text: next.text, selection: { start: next.caret, end: next.caret }, pending: null, composition: null };
}
