'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Folder, LoaderCircle, Tags, Trash2, X } from 'lucide-react';
import type { LibraryAction } from '@/lib/library-actions';
import { deckAncestors } from '@/lib/library-view';
import { appendTag, registeredTags } from '@/lib/tags';
import type { Note, Snapshot } from '@/lib/model';
import { Modal } from './editors';
import { TagInput } from './tag-input';

type Props = {
  data: Snapshot;
  notes: Note[];
  selected: string[];
  deckId: string | null;
  hiddenRoot?: string;
  busy: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onSave: (ids: string[], action: LibraryAction) => Promise<void>;
  children: ReactNode;
};

export function LibraryBulkActions({ data, notes, selected, deckId, hiddenRoot, busy, onSelectAll, onClear, onSave, children }: Props) {
  const [dialog, setDialog] = useState<'decks' | 'tags' | 'delete' | null>(null);
  const [deckAction, setDeckAction] = useState<'add-deck' | 'remove-deck'>('add-deck');
  const [target, setTarget] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const all = useRef<HTMLInputElement>(null);
  const availableTags = useMemo(() => registeredTags(data.notes), [data.notes]);
  const decks = data.decks.filter(deck => !deck.deletedAt && deck.id !== hiddenRoot);
  const allSelected = notes.length > 0 && selected.length === notes.length;
  useEffect(() => { if (all.current) all.current.indeterminate = selected.length > 0 && !allSelected; }, [selected.length, allSelected]);
  useEffect(() => { if (!selected.length) setDialog(null); }, [selected.length]);

  function open(next: typeof dialog) {
    setError(''); setTags([]); setDraft(''); setDeckAction('add-deck');
    setTarget(decks.some(deck => deck.id === deckId) ? deckId! : decks[0]?.id ?? '');
    setDialog(next);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !selected.length) return;
    setError('');
    try {
      let action: LibraryAction;
      if (dialog === 'tags') {
        const values = appendTag(tags, draft, availableTags);
        if (!values.length) return;
        action = { type: 'add-tags', tags: values };
      } else if (dialog === 'decks') action = { type: deckAction, deckId: target };
      else action = { type: 'delete' };
      await onSave(selected, action);
      setDialog(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update cards.'); }
  }

  return <>
    <div className="library-bulk-toolbar" role="toolbar" aria-label="Card actions">
      <label className="bulk-select-all"><input ref={all} type="checkbox" aria-label="Select all visible cards" checked={allSelected} disabled={busy || !notes.length} onChange={onSelectAll} /><span>{selected.length ? `${selected.length} selected` : 'Select cards'}</span></label>
      {selected.length > 0 ? <div className="bulk-actions">
        <button type="button" className="button small secondary" disabled={busy || !decks.length} onClick={() => open('decks')}><Folder size={14} />Decks</button>
        <button type="button" className="button small secondary" disabled={busy} onClick={() => open('tags')}><Tags size={14} />Tags</button>
        <button type="button" className="icon-button danger-text" aria-label="Delete selected cards" title="Delete selected cards" disabled={busy} onClick={() => open('delete')}><Trash2 size={16} /></button>
        <button type="button" className="icon-button" aria-label="Clear selection" title="Clear selection" disabled={busy} onClick={onClear}><X size={16} /></button>
      </div> : <div className="bulk-idle-actions">{children}</div>}
    </div>
    {dialog && <Modal title={dialog === 'decks' ? 'Organize cards' : dialog === 'tags' ? 'Add tags' : 'Delete cards'} subtitle={`${selected.length} card${selected.length === 1 ? '' : 's'} selected`} onClose={() => { if (!busy) setDialog(null); }} compact>
      <form className="editor-form" onSubmit={submit}>
        {dialog === 'decks' && <><label>Action<select value={deckAction} disabled={busy} onChange={event => setDeckAction(event.target.value as typeof deckAction)}><option value="add-deck">Add to deck</option><option value="remove-deck">Remove from deck</option></select></label><label>Deck<select required value={target} disabled={busy} onChange={event => setTarget(event.target.value)}>{decks.map(deck => <option key={deck.id} value={deck.id}>{deckAncestors(data, deck.id).filter(item => item.id !== hiddenRoot).map(item => item.name).join(' / ')}</option>)}</select></label></>}
        {dialog === 'tags' && <TagInput value={tags} onChange={setTags} draft={draft} onDraftChange={setDraft} available={availableTags} disabled={busy} />}
        {dialog === 'delete' && <p className="bulk-delete-description">Delete {selected.length} card{selected.length === 1 ? '' : 's'} and both review directions from your library?</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="button primary" disabled={busy || (dialog === 'decks' && !target) || (dialog === 'tags' && !tags.length && !draft.trim())}>{busy && <LoaderCircle size={15} className="spin" />}{dialog === 'delete' ? 'Delete cards' : 'Apply'}</button></div>
      </form>
    </Modal>}
  </>;
}
