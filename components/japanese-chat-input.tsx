'use client';

import { useEffect, useId, useLayoutEffect, useState } from 'react';
import { ArrowUp, Settings2, Square } from 'lucide-react';
import type { Snapshot } from '@/lib/model';
import { JapaneseText, useFuriganaParts } from './furigana';
import { useJapaneseEntry } from './use-japanese-entry';
import { PendingEntryHighlight } from './pending-entry-highlight';
import './japanese-chat-input.css';

type InputMode = 'hiragana' | 'katakana' | 'latin';
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
  const listId = useId();
  const entry = useJapaneseEntry({ data, value, onChange, mode, maxLength: 1000, onSubmit: text => { if (ready && !busy && text) onSend(text); } });
  const { editor, notes, open, selected, textareaProps } = entry;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'katakana' || saved === 'latin') setMode(saved);
    } catch { /* Keep the default mode when preferences are unavailable. */ }
  }, []);
  useLayoutEffect(() => {
    const textarea = editor.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value, editor]);
  function send(refocus = false) {
    if (ready && !busy) { entry.submit(); if (refocus) editor.current?.focus({ preventScroll: true }); }
  }
  function cycleMode() {
    entry.commit();
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* Keep the selected mode in memory. */ }
  }

  return <div className="chat-input-wrap">
    {open && <div className="chat-suggestions" role="listbox" id={listId} aria-label="Suggestions de vocabulaire">
      {notes.map((note, index) => <ChatSuggestion key={note.id} note={note} id={`${listId}-${index}`} active={index === selected} onInsert={() => entry.insert(note)} />)}
      <div className="chat-suggestion-help">↑↓ choisir · Entrée / Tab insérer · Échap valider</div>
    </div>}
    <div className="chat-input-composer">
      <button type="button" className="chat-input-mode" aria-label={`Mode de saisie : ${mode === 'hiragana' ? 'hiragana' : mode === 'katakana' ? 'katakana' : 'latin'}. Changer le mode`} title="Changer le mode de saisie" onClick={cycleMode}><span lang={mode === 'latin' ? undefined : 'ja'}>{modeLabel[mode]}</span></button>
      <div className="chat-input-editor">
      <textarea ref={editor} className="chat-input-textarea" value={value} rows={1} maxLength={1000} placeholder="日本語で話そう…" aria-label="Message en japonais" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${selected}` : undefined}
        autoCorrect="off" autoCapitalize="off" spellCheck={false}
        {...textareaProps} />
      <PendingEntryHighlight text={value} range={entry.pending} editor={editor} revision={mode} />
      </div>
      <button type="button" className={`chat-input-settings${settingsOpen ? ' is-open' : ''}`} aria-label="Paramètres de la conversation" aria-controls="discussion-settings" aria-expanded={settingsOpen} title="Paramètres" onClick={onSettings}><Settings2 size={17} /></button>
      {busy ? <button type="button" className="chat-input-send chat-input-stop" aria-label="Arrêter la réponse" title="Arrêter" onClick={onStop}><Square size={15} /></button>
        : <button type="button" className="chat-input-send" aria-label="Envoyer le message" title="Envoyer" disabled={!ready || !value.trim()} onClick={() => send(true)}><ArrowUp size={20} /></button>}
    </div>
  </div>;
}
