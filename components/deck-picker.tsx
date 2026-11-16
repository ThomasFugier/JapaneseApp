'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Folder, Search, X } from 'lucide-react';
import type { Deck } from '@/lib/model';
import { browseDecks, deckOptions } from '@/lib/deck-picker';
import { JapaneseText } from './furigana';
import './deck-picker.css';

type Props = { decks: readonly Deck[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean };
const MAX_DECKS = 100;

export function DeckPicker({ decks, value, onChange, disabled = false }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const options = useMemo(() => deckOptions(decks), [decks]);
  const byId = useMemo(() => new Map(options.map(option => [option.id, option])), [options]);
  const folder = folderId ? byId.get(folderId) : undefined;
  const currentId = folder?.id ?? null;
  const selected = value.flatMap(deckId => byId.has(deckId) ? [byId.get(deckId)!] : []);
  const visible = useMemo(() => browseDecks(options, currentId, query), [options, currentId, query]);
  const breadcrumbs = folder ? [...folder.ancestorIds, folder.id].flatMap(deckId => byId.has(deckId) ? [byId.get(deckId)!] : []) : [];
  const children = useMemo(() => {
    const counts = new Map<string, number>();
    for (const option of options) if (option.parentId) counts.set(option.parentId, (counts.get(option.parentId) ?? 0) + 1);
    return counts;
  }, [options]);

  function openFolder(next: string | null) {
    setFolderId(next); setQuery('');
    if (list.current) list.current.scrollTop = 0;
    requestAnimationFrame(() => navigation.current?.querySelector<HTMLButtonElement>('[aria-current="location"]')?.focus({ preventScroll: true }));
  }
  function toggle(deckId: string) {
    if (disabled) return;
    if (value.includes(deckId)) onChange(value.filter(item => item !== deckId));
    else if (value.length < MAX_DECKS) onChange([...value, deckId]);
  }
  const selectionDisabled = (deckId: string) => disabled || (value.length >= MAX_DECKS && !value.includes(deckId));

  return <div className="deck-picker">
    <div className="deck-picker-label"><label htmlFor={id}>Decks</label>{selected.length > 0 && <span>{selected.length} selected</span>}</div>
    {selected.length > 0 && <div className="deck-picker-selection">{selected.map(option => <span className="deck-picker-chip" key={option.id}><span className={'deck-dot ' + option.color} aria-hidden="true" /><span title={option.path}><JapaneseText text={option.path} /></span><button type="button" disabled={disabled} aria-label={'Remove deck ' + option.path} onClick={() => toggle(option.id)}><X size={13} /></button></span>)}</div>}
    <div className="deck-picker-browser">
      <nav ref={navigation} className="deck-picker-breadcrumbs" aria-label="Deck folders">
        {folder && <button type="button" className="deck-picker-up" disabled={disabled} aria-label="Go to parent deck" onClick={() => openFolder(folder.parentId)}><ArrowLeft size={15} /></button>}
        <button type="button" disabled={disabled} aria-current={!folder ? 'location' : undefined} onClick={() => openFolder(null)}>All decks</button>
        {breadcrumbs.map(option => <span key={option.id}><ChevronRight size={12} aria-hidden="true" /><button type="button" disabled={disabled} aria-current={option.id === currentId ? 'location' : undefined} onClick={() => openFolder(option.id)}><JapaneseText text={option.name} /></button></span>)}
      </nav>
      <div className="deck-picker-entry"><Search size={15} aria-hidden="true" /><input ref={input} id={id} className="deck-picker-query" type="search" aria-describedby={id + '-hint'} placeholder={folder ? 'Search in ' + folder.name + '…' : 'Search all decks…'} value={query} maxLength={120} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={disabled || !options.length} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter') { event.preventDefault(); if (visible.length) openFolder(visible[0].id); }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const buttons = list.current?.querySelectorAll<HTMLButtonElement>('button'); buttons?.[event.key === 'ArrowDown' ? 0 : buttons.length - 1]?.focus(); }
        else if (event.key === 'Escape' && (query || folder)) { event.preventDefault(); event.stopPropagation(); if (query) setQuery(''); else openFolder(folder!.parentId); }
      }} />{query && <button type="button" className="deck-picker-clear" disabled={disabled} aria-label="Clear deck search" onClick={() => { setQuery(''); input.current?.focus({ preventScroll: true }); }}><X size={14} /></button>}</div>
      {folder && <label className="deck-picker-current"><input type="checkbox" checked={value.includes(folder.id)} disabled={selectionDisabled(folder.id)} onChange={() => toggle(folder.id)} /><span>Use <strong><JapaneseText text={folder.name} /></strong></span></label>}
      <div className="deck-picker-options" ref={list} aria-label="Available decks">{visible.map(option => <div className="deck-picker-row" key={option.id}>
        <label className="deck-picker-check"><input type="checkbox" aria-label={'Select deck ' + option.path} checked={value.includes(option.id)} disabled={selectionDisabled(option.id)} onChange={() => toggle(option.id)} /></label>
        <button type="button" className="deck-picker-folder" aria-label={'Open deck ' + option.path} disabled={disabled} onClick={() => openFolder(option.id)}><Folder size={17} aria-hidden="true" /><span><strong><JapaneseText text={option.name} /></strong>{query && option.path !== option.name ? <small><JapaneseText text={option.path} /></small> : !!children.get(option.id) && <small>{children.get(option.id)} subdeck{children.get(option.id) === 1 ? '' : 's'}</small>}</span><ChevronRight size={15} aria-hidden="true" /></button>
      </div>)}{!visible.length && <p className="deck-picker-status" role="status">{query ? 'No matching decks in this folder.' : folder ? 'No subdecks. Select this deck above.' : 'No decks yet. This card will be available in All cards.'}</p>}</div>
    </div>
    <p id={id + '-hint'} className="deck-picker-hint">{value.length >= MAX_DECKS ? '100 decks selected.' : 'Open a folder to browse its subdecks. Check one or more decks to select them.'}</p>
  </div>;
}
