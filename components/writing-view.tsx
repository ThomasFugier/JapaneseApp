'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Download, ListFilter } from 'lucide-react';
import { applySuggestion, writingMatches, writingToken } from '@/lib/writing';
import { convertWritingInput, finishKanaInput, type KanaComposition, type WritingInputMode } from '@/lib/kana-input';
import type { Note, Snapshot } from '@/lib/model';
import type { JapaneseFont } from './use-workspace-context';
import { JapaneseText, useFuriganaEnabled, useFuriganaParts } from './furigana';
import './writing-view.css';

const DRAFT_KEY = 'kotoba-writing-draft-v1';
const INPUT_MODE_KEY = 'kotoba-writing-input-mode-v1';
const MAX_LENGTH = 100000;
type Selection = { start: number; end: number };
type Edit = { text: string; selection: Selection; composition: KanaComposition | null };
type Position = { top: number; left: number; width: number; maxHeight: number };
type ReadingPart = { text: string; reading?: string };
type ReadingSnapshot = { text: string; parts: readonly ReadingPart[] };

function retainUnchangedReadings(previous: ReadingSnapshot, text: string): ReadingPart[] {
  let prefix = 0;
  while (prefix < previous.text.length && prefix < text.length && previous.text[prefix] === text[prefix]) prefix++;
  let suffix = 0;
  while (suffix < previous.text.length - prefix && suffix < text.length - prefix && previous.text[previous.text.length - suffix - 1] === text[text.length - suffix - 1]) suffix++;
  const boundary = /[\s\p{P}]/u;
  let start = prefix;
  let oldEnd = previous.text.length - suffix;
  let newEnd = text.length - suffix;
  // A pending edit can change the reading of the whole adjacent Japanese word.
  while (start > 0 && !boundary.test(text[start - 1])) start--;
  while (oldEnd < previous.text.length && !boundary.test(previous.text[oldEnd])) oldEnd++;
  while (newEnd < text.length && !boundary.test(text[newEnd])) newEnd++;
  const result: ReadingPart[] = [];
  let offset = 0;
  let cursor = 0;
  const shift = text.length - previous.text.length;
  for (const part of previous.parts) {
    const end = offset + part.text.length;
    const nextStart = end <= start ? offset : offset >= oldEnd && offset + shift >= newEnd ? offset + shift : -1;
    if (part.reading && nextStart >= cursor && text.slice(nextStart, nextStart + part.text.length) === part.text) {
      if (nextStart > cursor) result.push({ text: text.slice(cursor, nextStart) });
      result.push(part);
      cursor = nextStart + part.text.length;
    }
    offset = end;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor) });
  return result;
}

function WritingFurigana({ text, size, japaneseFont, editor, paper }: {
  text: string;
  size: string;
  japaneseFont: JapaneseFont;
  editor: RefObject<HTMLTextAreaElement | null>;
  paper: RefObject<HTMLDivElement | null>;
}) {
  const { enabled, parts } = useFuriganaParts(text);
  const previousReadings = useRef<ReadingSnapshot | null>(null);
  const visibleParts = useMemo(() => {
    if (!enabled || parts.some(part => part.reading) || !previousReadings.current) return parts;
    if (previousReadings.current.text === text) return previousReadings.current.parts;
    return retainUnchangedReadings(previousReadings.current, text);
  }, [enabled, parts, text]);
  const overlay = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    previousReadings.current = enabled ? { text, parts: visibleParts } : null;
    const textarea = editor.current;
    const container = paper.current;
    const labels = overlay.current;
    if (!textarea || !container || !labels) return;
    if (!enabled || !visibleParts.some(part => part.reading)) { labels.replaceChildren(); return; }
    const mirror = document.createElement('div');
    mirror.className = 'writing-furigana-mirror';
    mirror.lang = 'ja';
    mirror.setAttribute('aria-hidden', 'true');
    const source = document.createTextNode(`${text}\u200b`);
    mirror.appendChild(source);
    container.appendChild(mirror);
    const context = document.createElement('canvas').getContext('2d');
    const range = document.createRange();
    let frame = 0;
    let disposed = false;

    const measure = () => {
      frame = 0;
      if (disposed) return;
      const style = getComputedStyle(textarea);
      const properties = ['box-sizing', 'width', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant', 'font-feature-settings', 'font-variation-settings', 'font-kerning', 'font-synthesis', 'letter-spacing', 'line-height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'word-spacing', 'tab-size', 'text-indent', 'text-align', 'text-transform', 'text-rendering', 'direction', 'unicode-bidi', 'writing-mode', 'text-orientation', 'white-space', 'overflow-wrap', 'word-break', 'line-break', 'hyphens', '-webkit-text-size-adjust'];
      properties.forEach(property => mirror.style.setProperty(property, style.getPropertyValue(property)));
      mirror.style.top = `${textarea.offsetTop}px`;
      mirror.style.left = `${textarea.offsetLeft}px`;
      const bounds = mirror.getBoundingClientRect();
      const contentLeft = textarea.offsetLeft + parseFloat(style.paddingLeft);
      const contentRight = textarea.offsetLeft + textarea.clientWidth - parseFloat(style.paddingRight);
      const baseFontSize = parseFloat(style.fontSize);
      const fontSize = Math.min(18, Math.max(10, baseFontSize * .45));
      const gap = 2;
      if (context) context.font = `400 ${fontSize}px ${getComputedStyle(labels).fontFamily}`;
      const candidates: { reading: string; left: number; right: number; top: number; width: number; fittedWidth: number }[] = [];
      let offset = 0;
      for (const part of visibleParts) {
        const end = offset + part.text.length;
        if (part.reading && end > offset) {
          range.setStart(source, offset); range.setEnd(source, end);
          // Keep a wrapped word's reading whole above its first visual fragment.
          const rect = Array.from(range.getClientRects()).find(item => item.width > 0 && item.height > 0);
          if (rect) candidates.push({
            reading: part.reading,
            left: rect.left - bounds.left + textarea.offsetLeft - textarea.scrollLeft,
            right: rect.right - bounds.left + textarea.offsetLeft - textarea.scrollLeft,
            top: rect.top - bounds.top + textarea.offsetTop - textarea.scrollTop,
            width: (context?.measureText(part.reading).width || Array.from(part.reading).length * fontSize) + Array.from(part.reading).length * fontSize * .025,
            fittedWidth: 0,
          });
        }
        offset = end;
      }
      candidates.sort((a, b) => a.top - b.top || a.left - b.left);
      candidates.forEach((candidate, index) => {
        const center = (candidate.left + candidate.right) / 2;
        candidate.fittedWidth = Math.max(0, Math.min(candidate.width, 2 * Math.min(center - contentLeft, contentRight - center)));
        const previous = candidates[index - 1];
        if (!previous || Math.abs(previous.top - candidate.top) >= 1) return;
        const distance = center - (previous.left + previous.right) / 2;
        const available = Math.max(0, 2 * (distance - gap));
        const combined = previous.fittedWidth + candidate.fittedWidth;
        if (combined > available) {
          const scale = available / combined;
          previous.fittedWidth *= scale;
          candidate.fittedWidth *= scale;
        }
      });
      const fragment = document.createDocumentFragment();
      candidates.forEach(candidate => {
        if (candidate.fittedWidth <= 0) return;
        const readingSize = Math.max(10, fontSize * candidate.fittedWidth / candidate.width);
        const horizontalScale = Math.min(1, candidate.fittedWidth / (candidate.width * readingSize / fontSize));
        const label = document.createElement('span');
        label.className = 'writing-furigana-label';
        label.style.left = `${(candidate.left + candidate.right) / 2}px`;
        label.style.top = `${candidate.top - fontSize - baseFontSize * .1}px`;
        label.style.fontSize = `${fontSize}px`;
        label.style.transform = `translateX(-50%) scaleX(${horizontalScale})`;
        const reading = document.createElement('span');
        reading.className = 'writing-furigana-reading';
        reading.textContent = candidate.reading;
        reading.style.fontSize = `${readingSize}px`;
        label.appendChild(reading);
        fragment.appendChild(label);
      });
      labels.replaceChildren(fragment);
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(textarea);
    observer.observe(container);
    textarea.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    void document.fonts.ready.then(schedule);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      textarea.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      document.fonts.removeEventListener('loadingdone', schedule);
      mirror.remove();
    };
  }, [enabled, visibleParts, text, size, japaneseFont, editor, paper]);

  return <div className="writing-furigana-overlay" ref={overlay} aria-hidden="true" />;
}

function WritingSuggestion({ note, prefix, id, active, onInsert }: { note: Note; prefix: string; id: string; active: boolean; onInsert: () => void }) {
  const { enabled, parts } = useFuriganaParts(note.japanese, note.reading);
  const hasFurigana = enabled && parts.some(part => part.reading);
  return <button type="button" role="option" id={id} aria-selected={active} tabIndex={-1} className={active ? 'active' : ''} onPointerDown={event => event.preventDefault()} onClick={onInsert}><span className="writing-suggestion-word" lang="ja"><JapaneseText text={prefix} /><JapaneseText text={note.japanese} reading={note.reading} />{!hasFurigana && <small><JapaneseText text={prefix} />{note.reading || [...(note.onReadings ?? []), ...(note.kunReadings ?? [])].join('・')}</small>}</span><span className="writing-suggestion-meaning"><JapaneseText text={note.meaning} /></span></button>;
}

export function WritingView({ data, japaneseFont }: { data: Snapshot; japaneseFont: JapaneseFont }) {
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
  const furiganaEnabled = useFuriganaEnabled();
  const matching = useMemo(() => suggestionsEnabled && focused && !composing && !dismissed && !suppressReopen.current
    ? writingMatches(data, text, selection.start, selection.end) : null,
  [data, text, selection, suggestionsEnabled, focused, composing, dismissed]);
  const notes = matching?.notes ?? [];
  const open = notes.length > 0;
  const previewStart = open ? writingToken(text, selection.start, selection.end)!.start : 0;

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
  }, [text, size, japaneseFont, furiganaEnabled, loaded, open, selection, measureCaret]);

  useLayoutEffect(() => {
    const textarea = editor.current;
    if (!textarea) return;
    let previousWidth = textarea.clientWidth;
    let disposed = false;
    const resizeEditor = () => {
      if (disposed) return;
      textarea.style.height = '0px';
      textarea.style.height = `${textarea.scrollHeight}px`;
      if (open) measureCaret();
    };
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth === previousWidth) return;
      previousWidth = textarea.clientWidth;
      resizeEditor();
    });
    observer.observe(textarea);
    document.fonts.addEventListener('loadingdone', resizeEditor);
    void document.fonts.ready.then(resizeEditor);
    return () => { disposed = true; observer.disconnect(); document.fonts.removeEventListener('loadingdone', resizeEditor); };
  }, [open, measureCaret]);

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
      const next = applySuggestion(latestText.current, matching.ranges.get(note.id) ?? matching.range, note.japanese);
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
      <textarea lang="ja" className={`writing-textarea ${size}${furiganaEnabled ? ' with-furigana' : ''}`} ref={editor} role="combobox" aria-label="Writing page" aria-multiline="true" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${Math.min(selected, notes.length - 1)}` : undefined} value={text} onChange={event => changed(event.currentTarget, (event.nativeEvent as InputEvent).inputType || 'insertText')} onSelect={event => readSelection(event.currentTarget)} onPointerDown={() => { suppressReopen.current = false; setDismissed(false); }} onFocus={() => setFocused(true)} onBlur={() => { finishInput(); setFocused(false); }} onKeyDown={onKey} onScroll={measureCaret} onCompositionStart={() => { kanaComposition.current = null; composingRef.current = true; setComposing(true); }} onCompositionEnd={event => { composingRef.current = false; setComposing(false); changed(event.currentTarget, 'insertCompositionText'); }} placeholder="こんにちは" maxLength={MAX_LENGTH} autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      <WritingFurigana text={text} size={size} japaneseFont={japaneseFont} editor={editor} paper={paper} />
      {open && <div className="writing-suggestions" ref={suggestionsPanel} style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
        <div role="listbox" id={listId} aria-label="Library suggestions">{notes.map((note, index) => <WritingSuggestion key={note.id} note={note} prefix={text.slice(previewStart, matching!.ranges.get(note.id)!.start)} id={`${listId}-${index}`} active={index === selected} onInsert={() => insert(note)} />)}</div>
        <div className="writing-suggestion-help">↑↓ · Space / Enter to insert · Esc to close</div>
      </div>}
    </div>
  </section>;
}

export default WritingView;
