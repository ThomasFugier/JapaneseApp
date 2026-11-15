'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Settings2, Square } from 'lucide-react';
import { applySuggestion, writingMatches } from '@/lib/writing';
import { convertWritingInput, finishKanaInput, type KanaComposition } from '@/lib/kana-input';
import type { Snapshot } from '@/lib/model';
import { JapaneseText, useFuriganaParts } from './furigana';
import './japanese-chat-input.css';

type InputMode = 'hiragana' | 'katakana' | 'latin';
type Selection = { start: number; end: number };
type Edit = { text: string; selection: Selection; composition: KanaComposition | null };
const MODE_KEY = 'kotoba-chat-input-mode-v1';
const modes: InputMode[] = ['hiragana', 'katakana', 'latin'];
const modeLabel: Record<InputMode, string> = { hiragana: 'あ', katakana: 'ア', latin: 'ABC' };

function ChatSuggestion({ note, active, id, onInsert }: { note: Snapshot['notes'][number]; active: boolean; id: string; onInsert: () => void }) {
  const { enabled, parts } = useFuriganaParts(note.japanese, note.reading);
  const hasFurigana = enabled && parts.some(part => part.reading);
  return <button type="button" role="option" id={id} aria-selected={active} tabIndex={-1} className={active ? 'active' : ''}
    onPointerDown={event => event.preventDefault()} onClick={onInsert}>
    <span className="chat-suggestion-word" lang="ja"><JapaneseText text={note.japanese} reading={note.reading} />
      {!hasFurigana && <small><JapaneseText text={note.reading || [...(note.onReadings ?? []), ...(note.kunReadings ?? [])].join('・')} /></small>}
    </span><span className="chat-suggestion-meaning"><JapaneseText text={note.meaning} /></span>
  </button>;
}

export function JapaneseChatInput({ data, value, onChange, onSend, onSettings, busy, ready, onStop, settingsOpen }: {
  data: Snapshot;
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onSettings: () => void;
  busy: boolean;
  ready: boolean;
  onStop: () => void;
  settingsOpen: boolean;
}) {
  const [mode, setMode] = useState<InputMode>('hiragana');
  const [selection, setSelection] = useState<Selection>({ start: value.length, end: value.length });
  const [focused, setFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const kanaComposition = useRef<KanaComposition | null>(null);
  const latestText = useRef(value);
  const lastSelection = useRef(selection);
  const pendingSelection = useRef<Selection | null>(null);
  const suppressReopenAt = useRef<Selection | null>(null);
  const undoEdits = useRef<Edit[]>([]);
  const redoEdits = useRef<Edit[]>([]);
  const callbacks = useRef({ onChange, onSend });
  callbacks.current = { onChange, onSend };
  const listId = useId();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'katakana' || saved === 'latin') setMode(saved);
    } catch { /* Keep the default mode when preferences are unavailable. */ }
  }, []);

  useEffect(() => {
    if (value === latestText.current) return;
    const cleared = value.length === 0;
    latestText.current = value;
    kanaComposition.current = null;
    if (cleared) {
      undoEdits.current = []; redoEdits.current = [];
      lastSelection.current = { start: 0, end: 0 };
      pendingSelection.current = { start: 0, end: 0 };
      suppressReopenAt.current = null;
      setSelection(lastSelection.current); setDismissed(false); setSelected(0);
    } else {
      const caret = Math.min(editor.current?.selectionStart ?? value.length, value.length);
      lastSelection.current = { start: caret, end: caret }; setSelection(lastSelection.current);
    }
  }, [value]);

  useLayoutEffect(() => {
    const textarea = editor.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);

  const matching = useMemo(() => focused && !composing && !dismissed
    ? writingMatches(data, value, selection.start, selection.end) : null,
  [data, value, selection, focused, composing, dismissed]);
  const notes = matching?.notes ?? [];
  const open = notes.length > 0;

  useLayoutEffect(() => {
    const textarea = editor.current;
    if (!textarea || pendingSelection.current === null) return;
    const next = pendingSelection.current;
    textarea.setSelectionRange(next.start, next.end);
    pendingSelection.current = null;
    if (suppressReopenAt.current && suppressReopenAt.current.start === next.start && suppressReopenAt.current.end === next.end) suppressReopenAt.current = null;
  }, [value]);

  function snapshot(): Edit { return { text: latestText.current, selection: { ...lastSelection.current }, composition: kanaComposition.current }; }
  function push(stack: Edit[], item: Edit) {
    stack.push(item);
    let characters = stack.reduce((total, entry) => total + entry.text.length, 0);
    while (stack.length > 100 || (characters > 2000000 && stack.length > 1)) characters -= stack.shift()!.text.length;
  }
  function remember() { push(undoEdits.current, snapshot()); redoEdits.current = []; }
  function restore(undo: boolean) {
    const next = (undo ? undoEdits.current : redoEdits.current).pop();
    if (!next) return;
    push(undo ? redoEdits.current : undoEdits.current, snapshot());
    latestText.current = next.text; kanaComposition.current = next.composition;
    lastSelection.current = next.selection; pendingSelection.current = next.selection;
    suppressReopenAt.current = next.selection;
    setSelection(next.selection); setDismissed(true); setSelected(0); callbacks.current.onChange(next.text);
  }

  function finishInput(selectionAfter?: Selection) {
    const next = finishKanaInput(latestText.current, kanaComposition.current);
    if (next && next.text !== latestText.current) {
      const previousLength = latestText.current.length;
      remember(); latestText.current = next.text;
      const delta = next.text.length - previousLength;
      const adjusted = selectionAfter ? {
        start: selectionAfter.start >= (kanaComposition.current?.end ?? next.caret) ? selectionAfter.start + delta : selectionAfter.start,
        end: selectionAfter.end >= (kanaComposition.current?.end ?? next.caret) ? selectionAfter.end + delta : selectionAfter.end,
      } : { start: next.caret, end: next.caret };
      lastSelection.current = adjusted;
      pendingSelection.current = lastSelection.current; setSelection(lastSelection.current); callbacks.current.onChange(next.text);
    }
    kanaComposition.current = null;
    return lastSelection.current;
  }

  function changed(textarea: HTMLTextAreaElement, inputType: string) {
    if (inputType === 'historyUndo' || inputType === 'historyRedo') { restore(inputType === 'historyUndo'); return; }
    let nextText = textarea.value;
    if (/[\uD800-\uDBFF]$/.test(nextText)) nextText = nextText.slice(0, -1);
    const converted = composingRef.current || textarea.selectionStart !== textarea.selectionEnd || mode === 'latin'
      ? { text: nextText, caret: textarea.selectionStart, composition: null }
      : convertWritingInput(latestText.current, nextText, textarea.selectionStart, mode, inputType, kanaComposition.current);
    if (converted.text !== latestText.current) remember();
    kanaComposition.current = converted.composition;
    if (converted.text !== nextText) pendingSelection.current = { start: converted.caret, end: converted.caret };
    latestText.current = converted.text;
    const caret = converted.text !== textarea.value ? converted.caret : textarea.selectionEnd;
    lastSelection.current = { start: caret, end: caret };
    suppressReopenAt.current = null;
    setSelection(lastSelection.current); setSelected(0); setDismissed(false); callbacks.current.onChange(converted.text);
  }

  function insert(index: number) {
    if (!matching || composingRef.current) return;
    try {
      const note = notes[index];
      const next = applySuggestion(latestText.current, matching.ranges.get(note.id) ?? matching.range, note.japanese);
      if (next.text.length > 1000) return;
      remember(); kanaComposition.current = null; latestText.current = next.text;
      lastSelection.current = { start: next.caret, end: next.caret }; pendingSelection.current = lastSelection.current;
      suppressReopenAt.current = lastSelection.current;
      setSelection(lastSelection.current); setSelected(0); setDismissed(true); callbacks.current.onChange(next.text);
      editor.current?.focus({ preventScroll: true });
    } catch { setDismissed(true); }
  }

  function send(refocus = false) {
    finishInput();
    const text = latestText.current.trim();
    if (ready && !busy && text) { callbacks.current.onSend(text); if (refocus) editor.current?.focus({ preventScroll: true }); }
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'z' || key === 'y') { event.preventDefault(); restore(key === 'z' && !event.shiftKey); return; }
    }
    if (event.key === 'Enter' && event.shiftKey) { setDismissed(true); return; }
    if (open) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(index => (index + 1) % notes.length); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(index => (index - 1 + notes.length) % notes.length); return; }
      if (event.key === 'Tab' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); insert(selected); return; }
      if (event.key === 'Escape') { event.preventDefault(); setDismissed(true); return; }
    }
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
  }

  function cycleMode() {
    finishInput();
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* Input remains usable without storage. */ }
  }

  return <div className="chat-input-wrap">
    {open && <div className="chat-suggestions" role="listbox" id={listId} aria-label="Suggestions de vocabulaire">
      {notes.map((note, index) => <ChatSuggestion key={note.id} note={note} id={`${listId}-${index}`} active={index === selected} onInsert={() => insert(index)} />)}
      <div className="chat-suggestion-help">↑↓ choisir · Entrée / Tab insérer · Échap fermer</div>
    </div>}
    <div className="chat-input-composer">
      <button type="button" className="chat-input-mode" aria-label={`Mode de saisie : ${mode === 'hiragana' ? 'hiragana' : mode === 'katakana' ? 'katakana' : 'latin'}. Changer le mode`} title="Changer le mode de saisie" onClick={cycleMode}><span lang={mode === 'latin' ? undefined : 'ja'}>{modeLabel[mode]}</span></button>
      <textarea ref={editor} className="chat-input-textarea" value={value} rows={1} maxLength={1000} placeholder="日本語で話そう…" aria-label="Message en japonais ou en français" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${selected}` : undefined}
        autoCorrect="off" autoCapitalize="off" spellCheck={false}
        onChange={event => changed(event.currentTarget, (event.nativeEvent as InputEvent).inputType || 'insertText')}
        onSelect={event => {
          const node = event.currentTarget;
          let next = { start: node.selectionStart, end: node.selectionEnd };
          if (kanaComposition.current && (next.start !== kanaComposition.current.end || next.end !== next.start)) next = finishInput(next);
          if (node.value !== latestText.current && !pendingSelection.current) return;
          if (suppressReopenAt.current && suppressReopenAt.current.start === next.start && suppressReopenAt.current.end === next.end) suppressReopenAt.current = null;
          else if (next.start !== lastSelection.current.start || next.end !== lastSelection.current.end) { suppressReopenAt.current = null; setDismissed(false); }
          lastSelection.current = next; setSelection(next); setSelected(0);
        }}
        onFocus={() => setFocused(true)} onBlur={() => { finishInput(); setFocused(false); }}
        onCompositionStart={() => { kanaComposition.current = null; composingRef.current = true; setComposing(true); }}
        onCompositionEnd={event => { composingRef.current = false; setComposing(false); changed(event.currentTarget, 'insertCompositionText'); }}
        onKeyDown={onKey} />
      <button type="button" className={`chat-input-settings${settingsOpen ? ' is-open' : ''}`} aria-label="Paramètres de la conversation" aria-controls="discussion-settings" aria-expanded={settingsOpen} title="Paramètres" onClick={onSettings}><Settings2 size={17} /></button>
      {busy ? <button type="button" className="chat-input-send chat-input-stop" aria-label="Arrêter la réponse" title="Arrêter" onClick={onStop}><Square size={15} /></button>
        : <button type="button" className="chat-input-send" aria-label="Envoyer le message" title="Envoyer" disabled={!ready || !value.trim()} onClick={() => send(true)}><ArrowUp size={20} /></button>}
    </div>
  </div>;
}
