'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { appendTag, suggestTags, tagKey } from '@/lib/tags';
import { JapaneseText } from './furigana';
import './tag-input.css';

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  available: string[];
  disabled?: boolean;
};

export function TagInput({ value, onChange, draft, onDraftChange, available, disabled = false }: Props) {
  const id = useId(), listId = `${id}-options`;
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const suggestions = suggestTags(available, value, draft);
  const open = focused && !dismissed && suggestions.length > 0 && !disabled && value.length < 30;
  const index = Math.min(active, suggestions.length - 1);
  const selected = value.some(tag => tagKey(tag) === tagKey(draft));
  const canCreate = !!draft.trim() && !selected && !available.some(tag => tagKey(tag) === tagKey(draft));

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, index, listId]);

  function add(label: string) {
    try {
      onChange(appendTag(value, label, available));
      onDraftChange(''); setDismissed(true); setActive(0); setError('');
      input.current?.focus();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add tag.'); }
  }

  return <div className="tag-editor">
    <label htmlFor={id}>Tags</label>
    <div className="tag-input">
      {value.map(tag => <span className="tag-chip" key={tag}><span><JapaneseText text={tag} /></span><button type="button" aria-label={`Remove tag ${tag}`} disabled={disabled} onClick={() => { onChange(value.filter(item => item !== tag)); setError(''); input.current?.focus(); }}><X size={13} /></button></span>)}
      <div className="tag-entry-row">
        <input ref={input} id={id} name="tag-query" className="tag-query" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${index}` : undefined} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} value={draft} placeholder="Find or add a tag…" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={80} disabled={disabled || value.length >= 30} onChange={event => { onDraftChange(event.target.value); setDismissed(false); setActive(0); setError(''); }} onFocus={() => { setFocused(true); setDismissed(false); }} onBlur={() => setFocused(false)} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowDown' && open) { event.preventDefault(); setActive((index + 1) % suggestions.length); }
          else if (event.key === 'ArrowUp' && open) { event.preventDefault(); setActive((index - 1 + suggestions.length) % suggestions.length); }
          else if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); if (draft.trim()) add(event.key === 'Enter' && open && !selected ? suggestions[index] : draft); }
          else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setDismissed(true); }
          else if (event.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }} />
        {canCreate && <button type="button" className="tag-add" disabled={disabled || value.length >= 30} title={`Add “${draft.trim()}”`} onPointerDown={event => event.preventDefault()} onClick={() => add(draft)}><Plus size={14} />Add</button>}
      </div>
    </div>
    {open && <div className="tag-suggestions" role="listbox" id={listId} aria-label="Existing tags">{suggestions.map((tag, option) => <button type="button" role="option" id={`${listId}-${option}`} key={tag} tabIndex={-1} aria-selected={option === index} className={option === index ? 'active' : ''} onPointerDown={event => event.preventDefault()} onClick={() => add(tag)}><JapaneseText text={tag} /></button>)}</div>}
    {selected && draft.trim() && <span className="tag-input-status" role="status">Already added</span>}
    {error && <span id={`${id}-error`} className="form-error" role="alert">{error}</span>}
  </div>;
}
