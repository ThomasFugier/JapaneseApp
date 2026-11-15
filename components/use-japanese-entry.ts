'use client';

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react';
import { changeJapaneseEntry, commitJapaneseEntry, createJapaneseEntry, insertJapaneseEntry, matchJapaneseEntry, type EntryRange, type JapaneseEntry } from '@/lib/japanese-entry';
import type { WritingInputMode } from '@/lib/kana-input';
import type { Note, Snapshot } from '@/lib/model';

export function useJapaneseEntry({ data, value, onChange, mode, maxLength, suggestionsEnabled = true, onSubmit }: {
  data: Snapshot; value: string; onChange: (text: string) => void; mode: WritingInputMode | 'latin'; maxLength: number; suggestionsEnabled?: boolean; onSubmit?: (text: string) => void;
}) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const [entry, setEntry] = useState(() => createJapaneseEntry(value));
  const current = useRef(entry);
  const [focused, setFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const [selected, setSelected] = useState(0);
  const pendingSelection = useRef<EntryRange | null>(null);
  const undo = useRef<JapaneseEntry[]>([]);
  const redo = useRef<JapaneseEntry[]>([]);
  const callbacks = useRef({ onChange, onSubmit }); callbacks.current = { onChange, onSubmit };

  const search = useMemo(() => ({ data, entry, enabled: suggestionsEnabled && focused && !composing }), [data, entry, suggestionsEnabled, focused, composing]);
  const deferred = useDeferredValue(search);
  const deferredMatch = useMemo(() => deferred.enabled ? matchJapaneseEntry(deferred.data, deferred.entry) : null, [deferred]);
  const matching = search === deferred ? deferredMatch : null;
  const notes = matching?.notes ?? [];

  function publish(next: JapaneseEntry, restoreCaret = false) {
    current.current = next;
    if (restoreCaret) pendingSelection.current = next.selection;
    setEntry(next); setSelected(0);
    callbacks.current.onChange(next.text);
  }
  function push(stack: JapaneseEntry[], item: JapaneseEntry) {
    stack.push(item);
    let characters = stack.reduce((total, edit) => total + edit.text.length, 0);
    while (stack.length > 100 || (characters > 2000000 && stack.length > 1)) characters -= stack.shift()!.text.length;
  }
  function remember() { push(undo.current, current.current); redo.current = []; }
  function restore(back: boolean) {
    const next = (back ? undo : redo).current.pop();
    if (!next) return;
    push((back ? redo : undo).current, current.current);
    publish(next, true);
  }
  function commit() {
    const previous = current.current;
    const next = commitJapaneseEntry(previous);
    if (previous.pending || previous.composition) { remember(); publish(next, next.text !== previous.text); }
    return next;
  }
  function insert(note: Note, match = matching) {
    if (!match || composingRef.current) return;
    try {
      const next = insertJapaneseEntry(current.current, match, note);
      if (next.text.length > maxLength) return;
      remember(); publish(next, true); editor.current?.focus({ preventScroll: true });
    } catch { /* Ignore a suggestion invalidated by a newer edit. */ }
  }
  function submit() { const next = commit(); callbacks.current.onSubmit?.(next.text.trim()); }

  useEffect(() => {
    if (value === current.current.text) return;
    const next = createJapaneseEntry(value);
    current.current = next; setEntry(next); setSelected(0);
    if (!value) { undo.current = []; redo.current = []; pendingSelection.current = next.selection; }
  }, [value]);

  useLayoutEffect(() => {
    const textarea = editor.current;
    const selection = pendingSelection.current;
    if (!textarea || !selection || composingRef.current) return;
    textarea.setSelectionRange(selection.start, selection.end);
    pendingSelection.current = null;
  }, [entry]);

  function changed(textarea: HTMLTextAreaElement, inputType: string) {
    if (inputType === 'historyUndo' || inputType === 'historyRedo') { restore(inputType === 'historyUndo'); return; }
    let raw = textarea.value.slice(0, maxLength);
    if (/[\uD800-\uDBFF]$/.test(raw)) raw = raw.slice(0, -1);
    const next = changeJapaneseEntry(current.current, raw, { start: textarea.selectionStart, end: textarea.selectionEnd }, mode, inputType, composingRef.current);
    if (next.text !== current.current.text) remember();
    publish(next, next.text !== raw);
  }
  function readSelection(textarea: HTMLTextAreaElement) {
    if (textarea.value !== current.current.text || pendingSelection.current || composingRef.current) return;
    const selection = { start: textarea.selectionStart, end: textarea.selectionEnd };
    if (selection.start === current.current.selection.start && selection.end === current.current.selection.end) return;
    const next = commitJapaneseEntry(current.current);
    if (next.text !== current.current.text) remember();
    publish({ ...next, selection });
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'z' || key === 'y') { event.preventDefault(); restore(key === 'z' && !event.shiftKey); return; }
    }
    if (event.key === 'Escape' && current.current.pending) { event.preventDefault(); commit(); return; }
    if (event.key === 'Enter' && event.shiftKey) { commit(); return; }
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', ' '].includes(event.key)) {
      // A fast confirmation key must use the newest entry, even before the
      // deferred library search has finished rendering its suggestions.
      const match = matching ?? (suggestionsEnabled && focused ? matchJapaneseEntry(data, current.current) : null);
      if (match?.notes.length) {
        event.preventDefault();
        if (event.key === 'ArrowDown') setSelected(index => (index + 1) % match.notes.length);
        else if (event.key === 'ArrowUp') setSelected(index => (index - 1 + match.notes.length) % match.notes.length);
        else insert(match.notes[Math.min(selected, match.notes.length - 1)], match);
        return;
      }
    }
    if (event.key === 'Enter') {
      if (callbacks.current.onSubmit) { event.preventDefault(); submit(); }
      else commit();
    } else if (['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commit();
  }

  const textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement> = {
    onBeforeInput: event => {
      const node = event.currentTarget;
      current.current = { ...current.current, selection: { start: node.selectionStart, end: node.selectionEnd } };
    },
    onChange: event => changed(event.currentTarget, (event.nativeEvent as InputEvent).inputType || 'insertText'),
    onSelect: event => readSelection(event.currentTarget),
    onPointerDown: () => { commit(); },
    onFocus: () => setFocused(true),
    onBlur: () => { if (!composingRef.current) commit(); setFocused(false); },
    onKeyDown,
    onCompositionStart: () => { commit(); composingRef.current = true; setComposing(true); },
    onCompositionEnd: event => { changed(event.currentTarget, 'insertCompositionText'); composingRef.current = false; setComposing(false); publish(commitJapaneseEntry(current.current)); },
  };
  return { editor, selection: entry.selection, pending: focused && !composing ? entry.pending : null, matching, notes, open: !!notes.length, selected, insert, commit, submit, textareaProps };
}
