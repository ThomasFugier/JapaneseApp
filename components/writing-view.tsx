'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download, ListFilter } from 'lucide-react';
import { applySuggestion, writingMatches } from '@/lib/writing';
import { convertWritingInput, finishKanaInput, type KanaComposition, type WritingInputMode } from '@/lib/kana-input';
import type { Note, Snapshot } from '@/lib/model';
import './writing-view.css';

const DRAFT_KEY = 'kotoba-writing-draft-v1';
const INPUT_MODE_KEY = 'kotoba-writing-input-mode-v1';
const MAX_LENGTH = 100000;
type Selection = { start: number; end: number };
type Edit = { text: string; selection: Selection; composition: KanaComposition | null };
type Position = { top: number; left: number; width: number; maxHeight: number };

export function WritingView({ data }: { data: Snapshot }) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(true);
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  const [inputMode, setInputMode] = useState<WritingInputMode>('hiragana');
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState(0);
  const [position, setPosition] = useState<Position>({ top: 70, left: 24, width: 340, maxHeight: 250 });
  const editor = useRef<HTMLTextAreaElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const suggestionsPanel = useRef<HTMLDivElement>(null);
  const draftReadable = useRef(true);
  const composingRef = useRef(false);
  const kanaComposition = useRef<KanaComposition | null>(null);
  const suppressReopen = useRef(false);
  const latestText = useRef(text);
  const lastSelection = useRef(selection);
  const pendingSelection = useRef<Selection | null>(null);
  const undoEdits = useRef<Edit[]>([]);
  const redoEdits = useRef<Edit[]>([]);
  const listId = useId();
  const matching = useMemo(() => suggestionsEnabled && focused && !composing && !dismissed && !suppressReopen.current
    ? writingMatches(data, text, selection.start, selection.end) : null,
  [data, text, selection, suggestionsEnabled, focused, composing, dismissed]);
  const notes = matching?.notes ?? [];
  const open = notes.length > 0;

  const saveDraft = useCallback((value: string) => {
    if (!draftReadable.current) { setSaved(false); return; }
    try { localStorage.setItem(DRAFT_KEY, value); setSaved(true); }
    catch { setSaved(false); }
  }, []);

  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      const mode = localStorage.getItem(INPUT_MODE_KEY);
      if (mode === 'katakana') setInputMode(mode);
      if (draft !== null) {
        if (draft.length > MAX_LENGTH) { draftReadable.current = false; setSaved(false); }
        else { setText(draft); latestText.current = draft; }
      }
    } catch { draftReadable.current = false; setSaved(false); }
    setLoaded(true);
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveDraft(latestText.current);
    };
    const onPageHide = () => saveDraft(latestText.current);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onPageHide); };
  }, [saveDraft]);

  useEffect(() => { if (loaded) saveDraft(text); }, [text, loaded, saveDraft]);

  const measureCaret = useCallback(() => {
    const textarea = editor.current;
    const container = paper.current;
    if (!textarea || !container) return;
    const style = getComputedStyle(textarea);
    const mirror = document.createElement('div');
    mirror.lang = textarea.lang;
    const properties = ['box-sizing', 'width', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'line-height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'word-spacing', 'tab-size', 'text-indent'];
    properties.forEach(property => mirror.style.setProperty(property, style.getPropertyValue(property)));
    Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '0', border: '0' });
    mirror.textContent = textarea.value.slice(0, textarea.selectionStart);
    const marker = document.createElement('span');
    marker.textContent = textarea.value.slice(textarea.selectionStart, textarea.selectionStart + 1) || '\u200b';
    mirror.appendChild(marker); document.body.appendChild(mirror);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.9;
    let top = textarea.offsetTop + marker.offsetTop - textarea.scrollTop + lineHeight;
    const availableWidth = container.clientWidth;
    const width = Math.max(120, Math.min(370, availableWidth - 24));
    const left = Math.max(12, Math.min(textarea.offsetLeft + marker.offsetLeft - textarea.scrollLeft, availableWidth - width - 12));
    const viewport = window.visualViewport;
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
    const maxHeight = Math.min(250, Math.max(130, (viewport?.height ?? window.innerHeight) - 100));
    if (container.getBoundingClientRect().top + top + maxHeight > bottom && top > maxHeight + lineHeight) top -= maxHeight + lineHeight;
    mirror.remove();
    setPosition({ top: Math.max(8, top), left, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    const textarea = editor.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (pendingSelection.current !== null) {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(pendingSelection.current.start, pendingSelection.current.end);
      pendingSelection.current = null;
    }
    if (open) measureCaret();
  }, [text, size, loaded, open, selection, measureCaret]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => measureCaret();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition); window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [open, measureCaret]);

  useLayoutEffect(() => {
    const panel = suggestionsPanel.current;
    const option = document.getElementById(`${listId}-${selected}`);
    if (!open || !panel || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    const footer = panel.querySelector<HTMLElement>('.writing-suggestion-help')?.offsetHeight ?? 0;
    const visibleHeight = panel.clientHeight - footer;
    if (top < panel.scrollTop) panel.scrollTop = Math.max(0, top - 4);
    else if (bottom > panel.scrollTop + visibleHeight) panel.scrollTop = bottom - visibleHeight + 4;
  }, [open, selected, listId]);

  function readSelection(textarea: HTMLTextAreaElement, reopen = true) {
    if (textarea.value !== latestText.current) return;
    const next = { start: textarea.selectionStart, end: textarea.selectionEnd };
    if (kanaComposition.current && (next.start !== kanaComposition.current.end || next.end !== next.start)) finishInput();
    if (next.start !== lastSelection.current.start || next.end !== lastSelection.current.end) {
      lastSelection.current = next; setSelection(next); setSelected(0);
      if (reopen && !suppressReopen.current) setDismissed(false);
    }
  }

  function changed(textarea: HTMLTextAreaElement, inputType = 'insertText') {
    if (inputType === 'historyUndo' || inputType === 'historyRedo') { restoreEdit(inputType === 'historyUndo'); return; }
    let value = textarea.value.slice(0, MAX_LENGTH);
    if (/[\uD800-\uDBFF]$/.test(value)) value = value.slice(0, -1);
    const converted = composingRef.current || textarea.selectionStart !== textarea.selectionEnd
      ? { text: value, caret: textarea.selectionStart, composition: null }
      : convertWritingInput(latestText.current, value, textarea.selectionStart, inputMode, inputType, kanaComposition.current);
    if (converted.text !== latestText.current) rememberEdit();
    kanaComposition.current = converted.composition;
    if (converted.text !== value) pendingSelection.current = { start: converted.caret, end: converted.caret };
    value = converted.text;
    suppressReopen.current = false;
    latestText.current = value; setText(value); setDismissed(false); setSelected(0);
    lastSelection.current = { start: converted.caret, end: converted.text !== textarea.value ? converted.caret : textarea.selectionEnd };
    setSelection(lastSelection.current);
  }

  function finishInput() {
    const next = finishKanaInput(latestText.current, kanaComposition.current);
    if (next && next.text !== latestText.current) rememberEdit();
    kanaComposition.current = null;
    if (next && next.text !== latestText.current) { latestText.current = next.text; setText(next.text); }
  }

  function changeInputMode(mode: WritingInputMode) {
    finishInput();
    setInputMode(mode);
    try { localStorage.setItem(INPUT_MODE_KEY, mode); } catch { /* Input remains usable without storage. */ }
  }

  function snapshotEdit(): Edit {
    return { text: latestText.current, selection: { ...lastSelection.current }, composition: kanaComposition.current };
  }

  function pushEdit(stack: Edit[], edit: Edit) {
    stack.push(edit);
    let characters = stack.reduce((total, item) => total + item.text.length, 0);
    while (stack.length > 100 || (characters > 2000000 && stack.length > 1)) characters -= stack.shift()!.text.length;
  }

  function rememberEdit() {
    pushEdit(undoEdits.current, snapshotEdit());
    redoEdits.current = [];
  }

  function restoreEdit(undo: boolean) {
    const next = (undo ? undoEdits.current : redoEdits.current).pop();
    if (!next) return;
    pushEdit(undo ? redoEdits.current : undoEdits.current, snapshotEdit());
    latestText.current = next.text; kanaComposition.current = next.composition;
    lastSelection.current = next.selection; pendingSelection.current = next.selection;
    suppressReopen.current = true;
    setText(next.text); setSelection(next.selection); setDismissed(true); setSelected(0);
  }

  function insert(note: Note) {
    if (!matching || composingRef.current) return;
    try {
      const next = applySuggestion(latestText.current, matching.range, note.japanese);
      if (next.text.length > MAX_LENGTH) return;
      rememberEdit();
      suppressReopen.current = true;
      kanaComposition.current = null;
      latestText.current = next.text; pendingSelection.current = { start: next.caret, end: next.caret };
      lastSelection.current = { start: next.caret, end: next.caret };
      setText(next.text); setSelection(lastSelection.current); setSelected(0); setDismissed(true); setFocused(true);
    } catch { setDismissed(true); }
  }

  function onKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'z' || key === 'y') { event.preventDefault(); restoreEdit(key === 'z' && !event.shiftKey); return; }
    }
    if (!open && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      suppressReopen.current = false; setDismissed(false);
    }
    if (!open) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(previous => (previous + 1) % notes.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(previous => (previous - 1 + notes.length) % notes.length); }
    else if (event.key === 'Enter' || event.key === 'Tab' || event.key === ' ') { event.preventDefault(); insert(notes[Math.min(selected, notes.length - 1)]); }
    else if (event.key === 'Escape') { event.preventDefault(); suppressReopen.current = true; setDismissed(true); }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `japanese-writing-${new Date().toISOString().slice(0, 10)}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="writing-view">
    <div className="writing-meta"><span className={`writing-save-status ${saved ? '' : 'unsaved'}`} role="status">{saved ? 'Local draft' : 'Draft not saved'}</span></div>
    <div className="writing-toolbar" aria-label="Writing tools">
      <div className="writing-input-modes" role="group" aria-label="Input mode">{(['hiragana', 'katakana'] as const).map((mode, index) => <button type="button" key={mode} aria-pressed={inputMode === mode} aria-label={`${mode} input`} title={['Hiragana', 'Katakana'][index]} onClick={() => changeInputMode(mode)}><span lang="ja">{['あ', 'ア'][index]}</span></button>)}</div>
      <div className="writing-font-sizes" aria-label="Text size">{(['small', 'medium', 'large'] as const).map((value, index) => <button type="button" key={value} aria-pressed={size === value} aria-label={`${['Small', 'Medium', 'Large'][index]} text size`} onClick={() => setSize(value)}>{['S', 'M', 'L'][index]}</button>)}</div>
      <button type="button" className={`writing-suggestion-toggle ${suggestionsEnabled ? 'enabled' : ''}`} aria-pressed={suggestionsEnabled} onClick={() => { suppressReopen.current = false; setSuggestionsEnabled(!suggestionsEnabled); setDismissed(false); }}><ListFilter size={16} />Suggestions</button>
      <button type="button" className="icon-button writing-download" aria-label="Download text" title="Download text" onClick={download} disabled={!text}><Download size={17} /></button>
    </div>
    <div className="writing-paper" ref={paper}>
      <textarea lang="ja" className={`writing-textarea ${size}`} ref={editor} role="combobox" aria-label="Writing page" aria-multiline="true" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${Math.min(selected, notes.length - 1)}` : undefined} value={text} onChange={event => changed(event.currentTarget, (event.nativeEvent as InputEvent).inputType || 'insertText')} onSelect={event => readSelection(event.currentTarget)} onPointerDown={() => { suppressReopen.current = false; setDismissed(false); }} onFocus={() => setFocused(true)} onBlur={() => { finishInput(); setFocused(false); }} onKeyDown={onKey} onScroll={measureCaret} onCompositionStart={() => { kanaComposition.current = null; composingRef.current = true; setComposing(true); }} onCompositionEnd={event => { composingRef.current = false; setComposing(false); changed(event.currentTarget, 'insertCompositionText'); }} placeholder="こんにちは" maxLength={MAX_LENGTH} autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      {open && <div className="writing-suggestions" ref={suggestionsPanel} style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
        <div role="listbox" id={listId} aria-label="Library suggestions">{notes.map((note, index) => <button type="button" role="option" key={note.id} id={`${listId}-${index}`} aria-selected={index === selected} tabIndex={-1} className={index === selected ? 'active' : ''} onPointerDown={event => event.preventDefault()} onClick={() => insert(note)}><span className="writing-suggestion-word" lang="ja">{note.japanese}<small>{note.reading || [...(note.onReadings ?? []), ...(note.kunReadings ?? [])].join('・')}</small></span><span className="writing-suggestion-meaning">{note.meaning}</span></button>)}</div>
        <div className="writing-suggestion-help">↑↓ · Space / Enter to insert · Esc to close</div>
      </div>}
    </div>
  </section>;
}

export default WritingView;
