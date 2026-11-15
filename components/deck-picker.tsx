'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Folder, X } from 'lucide-react';
import type { Deck } from '@/lib/model';
import { deckOptions, suggestDecks, type DeckOption } from '@/lib/deck-picker';
import { JapaneseText } from './furigana';
import './deck-picker.css';

type Props = { decks: readonly Deck[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean };
const MAX_DECKS = 100;

export function DeckPicker({ decks, value, onChange, disabled = false }: Props) {
  const id = useId(), listId = `${id}-options`;
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const options = useMemo(() => deckOptions(decks), [decks]);
  const byId = useMemo(() => new Map(options.map(option => [option.id, option])), [options]);
  const selected = value.flatMap(deckId => byId.has(deckId) ? [byId.get(deckId)!] : []);
  const suggestions = useMemo(() => suggestDecks(options, value, query), [options, value, query]);
  const visible = focused && !dismissed && !disabled && value.length < MAX_DECKS;
  const open = visible && suggestions.length > 0;
  const index = Math.max(0, Math.min(active, suggestions.length - 1));
  const remaining = options.length - selected.length;

  useEffect(() => {
    const container = list.current;
    const option = container?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!open || !container || !option) return;
    const bounds = container.getBoundingClientRect(), row = option.getBoundingClientRect();
    // Keep keyboard navigation inside the suggestion list, without scrolling the form.
    if (row.top < bounds.top) container.scrollTop -= bounds.top - row.top;
    else if (row.bottom > bounds.bottom) container.scrollTop += row.bottom - bounds.bottom;
  }, [open, index, suggestions]);

  function add(option: DeckOption) {
    if (disabled || value.length >= MAX_DECKS || value.includes(option.id)) return;
    onChange([...value, option.id]);
    setQuery(''); setActive(0); setDismissed(true);
    input.current?.focus({ preventScroll: true });
  }
  function remove(deckId: string) {
    onChange(value.filter(item => item !== deckId));
    input.current?.focus({ preventScroll: true });
  }

  return <div className="deck-picker">
    <div className="deck-picker-label"><label htmlFor={id}>Decks</label>{selected.length > 0 && <span>{selected.length} selected</span>}</div>
    <div className="deck-picker-control">
      {selected.map(option => <span className="deck-picker-chip" key={option.id}><span className={`deck-dot ${option.color}`} aria-hidden="true" /><span title={option.path}><JapaneseText text={option.path} /></span><button type="button" disabled={disabled} aria-label={`Remove deck ${option.path}`} onPointerDown={event => event.preventDefault()} onClick={() => remove(option.id)}><X size={13} /></button></span>)}
      <div className="deck-picker-entry"><Folder size={16} aria-hidden="true" /><input ref={input} id={id} className="deck-picker-query" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${index}` : undefined} aria-describedby={`${id}-hint`} placeholder="Search decks…" value={query} maxLength={120} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={disabled || !options.length || value.length >= MAX_DECKS} onChange={event => { setQuery(event.target.value); setActive(0); setDismissed(false); }} onFocus={() => { setFocused(true); setDismissed(false); }} onClick={() => setDismissed(false)} onBlur={() => setFocused(false)} onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'ArrowDown' && suggestions.length) { event.preventDefault(); setDismissed(false); setActive(open ? (index + 1) % suggestions.length : 0); }
        else if (event.key === 'ArrowUp' && suggestions.length) { event.preventDefault(); setDismissed(false); setActive(open ? (index - 1 + suggestions.length) % suggestions.length : suggestions.length - 1); }
        else if (event.key === 'Enter') { event.preventDefault(); if (open) add(suggestions[index]); }
        else if (event.key === 'Escape' && visible) { event.preventDefault(); event.stopPropagation(); setDismissed(true); }
      }} />{query && <button type="button" className="deck-picker-clear" disabled={disabled} aria-label="Clear deck search" onPointerDown={event => event.preventDefault()} onClick={() => { setQuery(''); setActive(0); setDismissed(false); input.current?.focus({ preventScroll: true }); }}><X size={14} /></button>}</div>
    </div>
    {open && <div className="deck-picker-options" ref={list} role="listbox" id={listId} aria-label="Available decks">{suggestions.map((option, optionIndex) => <button type="button" role="option" id={`${listId}-${optionIndex}`} key={option.id} tabIndex={-1} aria-selected={optionIndex === index} className={optionIndex === index ? 'active' : ''} disabled={disabled} onPointerDown={event => event.preventDefault()} onClick={() => add(option)}><span className={`deck-dot ${option.color}`} aria-hidden="true" /><span><strong><JapaneseText text={option.name} /></strong>{option.path !== option.name && <small><JapaneseText text={option.path} /></small>}</span></button>)}</div>}
    {visible && !suggestions.length && options.length > 0 && <p className="deck-picker-status" role="status">{remaining ? 'No matching decks. Try another name.' : 'All decks are selected.'}</p>}
    <p id={`${id}-hint`} className="deck-picker-hint">{!options.length ? 'No decks yet. This card will be available in All cards.' : value.length >= MAX_DECKS ? '100 decks selected.' : open ? 'Choose a suggestion or keep typing to narrow the list.' : 'Choose one or more decks. Leave empty to keep the card in All cards.'}</p>
  </div>;
}
