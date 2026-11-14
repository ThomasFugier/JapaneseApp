'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, X } from 'lucide-react';
import { descendants } from '@/lib/engine';
import { appendTag, registeredTags } from '@/lib/tags';
import { JapaneseText } from './furigana';
import { TagInput } from './tag-input';
import { updateNoteContent } from '@/lib/note-edit';
import { type Deck, type Note, type Snapshot, type StudyCard, validateSnapshot } from '@/lib/model';
import './note-editor.css';

export function Modal({ title, subtitle, onClose, children, compact = false, sheet = false, focusInput = true }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; compact?: boolean; sheet?: boolean; focusInput?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const heading = useId();
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const root = ref.current;
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]') ?? []).filter(item => !item.hidden && item.offsetParent !== null);
    const first = (focusInput ? focusables().find(item => item.tagName === 'INPUT') : undefined) ?? focusables()[0];
    first?.focus();
    function handle(event: KeyboardEvent) {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== root) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key === 'Tab') {
        const elements = focusables(); const first = elements[0]; const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    window.addEventListener('keydown', handle);
    return () => { window.removeEventListener('keydown', handle); document.body.style.overflow = overflow; previous?.focus(); };
  }, [focusInput]);
  return <div className={`modal-backdrop${sheet ? ' note-sheet-backdrop' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal${compact ? ' compact-note-modal' : ''}${sheet ? ' note-editor-sheet' : ''}`} role="dialog" aria-modal="true" aria-labelledby={heading} ref={ref}><div className="modal-heading"><div>{subtitle && <span className="eyebrow">{subtitle}</span>}<h2 id={heading}>{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={21} /></button></div>{children}</div></div>;
}

type Save = (fn: (snapshot: Snapshot) => Snapshot) => Promise<void>;

export function DeckEditor({ data, deck, defaultParentId, onClose, onSave }: { data: Snapshot; deck: Deck | null; defaultParentId: string | null; onClose: () => void; onSave: Save }) {
  const [name, setName] = useState(deck?.name ?? '');
  const [description, setDescription] = useState(deck?.description ?? '');
  const [parentId, setParentId] = useState(deck?.parentId ?? defaultParentId ?? '');
  const [color, setColor] = useState<Deck['color']>(deck?.color ?? 'sage');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const excluded = deck ? descendants(data, deck.id) : [];
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    const value: Deck = { id: deck?.id ?? crypto.randomUUID(), name: name.trim(), description: description.trim(), parentId: parentId || null, color, updatedAt: new Date().toISOString() };
    try { await onSave(snapshot => validateSnapshot({ ...snapshot, decks: deck ? snapshot.decks.map(item => item.id === deck.id ? value : item) : [...snapshot.decks, value] })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save.'); }
    finally { setBusy(false); }
  }
  return <Modal title={deck ? 'Edit deck' : 'New deck'} onClose={onClose}><form onSubmit={submit} className="editor-form"><label>Deck name<input required maxLength={120} placeholder="e.g. At the restaurant" value={name} onChange={event => setName(event.target.value)} /></label><label>Description <span className="optional">optional</span><textarea rows={2} maxLength={2000} placeholder="Deck description" value={description} onChange={event => setDescription(event.target.value)} /></label><label>Place in<select value={parentId} onChange={event => setParentId(event.target.value)}><option value="">No parent · top-level deck</option>{data.decks.filter(item => !item.deletedAt && !excluded.includes(item.id)).map(item => <option key={item.id} value={item.id}>{path(data, item)}</option>)}</select></label><fieldset className="color-fieldset"><legend>Color</legend><div className="color-options">{(['sage', 'amber', 'rose', 'sky'] as const).map(item => <button type="button" key={item} className={`color-option ${item} ${item === color ? 'chosen' : ''}`} onClick={() => setColor(item)} aria-label={{ sage: 'Sage green', amber: 'Amber', rose: 'Rose', sky: 'Blue' }[item]} aria-pressed={item === color}>{item === color && <Check size={17} />}</button>)}</div></fieldset>{error && <p role="alert" className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />}{deck ? 'Save' : 'Create deck'}</button></div></form></Modal>;
}

const noteValues = (note: Note | null) => ({ japanese: note?.japanese ?? '', reading: note?.reading ?? '', onReadings: note?.onReadings?.join('・') ?? '', kunReadings: note?.kunReadings?.join('・') ?? '', meaning: note?.meaning ?? '', example: note?.example ?? '', exampleTranslation: note?.exampleTranslation ?? '', explanation: note?.explanation ?? '' });

export type NoteNavigationGuard = () => Promise<boolean>;
type NoteEditorNavigation = { index: number; total: number; onPrevious?: () => void; onNext?: () => void };

function NotePanel({ title, onClose, navigation, children }: { title: string; onClose: () => void; navigation: React.ReactNode; children: React.ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const heading = useId();
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[role="dialog"]') && root.current?.contains(document.activeElement)) {
        event.preventDefault(); close.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <section className="note-side-panel" role="region" aria-labelledby={heading} ref={root}><div className="note-panel-heading"><h2 id={heading}>{title}</h2><button type="button" className="icon-button" aria-label="Close editor" onClick={onClose}><X size={19} /></button></div>{navigation}{children}</section>;
}

export function NoteEditor({ data, note, defaultDeckId, onClose, onSave, contentOnly = false, presentation = 'modal', navigation, onNavigationGuard, initialValues }: { data: Snapshot; note: Note | null; initialValues?: Pick<Note, 'japanese' | 'reading' | 'meaning'>; defaultDeckId: string | null; onClose: () => void; onSave: Save; contentOnly?: boolean; presentation?: 'modal' | 'panel'; navigation?: NoteEditorNavigation; onNavigationGuard?: (guard: NoteNavigationGuard | null) => void }) {
  const existing = data.cards.filter(card => card.noteId === note?.id && !card.deletedAt);
  const [values, setValues] = useState(() => ({ ...noteValues(note), ...(!note ? initialValues : {}) }));
  const [tags, setTags] = useState<string[]>(() => [...(note?.tags ?? [])]);
  const [tagDraft, setTagDraft] = useState('');
  const availableTags = useMemo(() => registeredTags(data.notes), [data.notes]);
  const [deckIds, setDeckIds] = useState<string[]>(note ? [...new Set(existing.flatMap(card => card.deckIds))] : defaultDeckId ? [defaultDeckId] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [smallScreen, setSmallScreen] = useState(false);
  const panel = presentation === 'panel';
  const form = useRef<HTMLFormElement>(null);
  const saving = useRef(false);
  const discarding = useRef(false);
  const draftKey = JSON.stringify({ values, tags, deckIds: [...deckIds].sort(), tagDraft });
  const savedKey = useRef(draftKey);
  const baselineNote = useRef(note);
  const baselineDecks = useRef([...deckIds].sort().join('\0'));
  const dirty = draftKey !== savedKey.current;
  const guard = useRef<NoteNavigationGuard>(async () => true);
  useEffect(() => {
    if (!panel) return;
    const media = window.matchMedia('(max-width:900px)');
    const update = () => setSmallScreen(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [panel]);
  useEffect(() => {
    if (!panel || !onNavigationGuard) return;
    onNavigationGuard(() => guard.current());
    return () => onNavigationGuard(null);
  }, [panel, onNavigationGuard]);
  useEffect(() => {
    if (!panel || !dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [panel, dirty]);
  useEffect(() => {
    if (!panel || dirty || saving.current || !note) return;
    const current = data.notes.find(item => item.id === note.id && !item.deletedAt);
    if (!current) return;
    const nextValues = noteValues(current);
    const nextDecks = [...new Set(data.cards.filter(card => card.noteId === note.id && !card.deletedAt).flatMap(card => card.deckIds))];
    baselineNote.current = current; baselineDecks.current = [...nextDecks].sort().join('\0');
    savedKey.current = JSON.stringify({ values: nextValues, tags: current.tags, deckIds: [...nextDecks].sort(), tagDraft: '' });
    setValues(nextValues); setTags([...current.tags]); setDeckIds(nextDecks); setTagDraft('');
  }, [data, note?.id, panel, dirty]);
  function field(key: keyof typeof values) { return { value: values[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues(previous => ({ ...previous, [key]: event.target.value })) }; }
  async function save(): Promise<boolean> {
    if (saving.current) return false;
    if (panel && !dirty) return true;
    if (form.current && !form.current.reportValidity()) return false;
    saving.current = true; setBusy(true); setError('');
    try {
      const finalTags = appendTag(tags, tagDraft, availableTags);
      let savedNote: Note | null = null;
      await onSave(snapshot => {
        const now = new Date().toISOString(); const id = note?.id ?? crypto.randomUUID();
        const value: Note = { id, createdAt: note?.createdAt ?? note?.updatedAt ?? now, japanese: values.japanese.trim(), reading: values.reading.trim(), onReadings: [...new Set(values.onReadings.split(/[、,;・\s]+/u).filter(Boolean))], kunReadings: [...new Set(values.kunReadings.split(/[、,;・\s]+/u).filter(Boolean))], meaning: values.meaning.trim(), example: values.example.trim(), exampleTranslation: values.exampleTranslation.trim(), explanation: values.explanation.trim(), tags: finalTags, updatedAt: now };
        if (panel && note) {
          const current = snapshot.notes.find(item => item.id === id && !item.deletedAt);
          if (!current) throw new Error('This card is no longer available.');
          if (current.updatedAt !== baselineNote.current?.updatedAt) throw new Error('This card changed while you were editing. Discard and reopen it to load the latest version.');
          const currentDecks = [...new Set(snapshot.cards.filter(card => card.noteId === id && !card.deletedAt).flatMap(card => card.deckIds))];
          const changedDecks = [...deckIds].sort().join('\0') !== baselineDecks.current;
          if (changedDecks && [...currentDecks].sort().join('\0') !== baselineDecks.current && [...currentDecks].sort().join('\0') !== [...deckIds].sort().join('\0')) throw new Error('This card’s decks changed while you were editing. Discard and reopen it to load the latest version.');
          const updated = updateNoteContent(snapshot, value);
          savedNote = updated.notes.find(item => item.id === id)!;
          if (!changedDecks) return updated;
          return validateSnapshot({ ...updated, cards: updated.cards.map(card => card.noteId === id && !card.deletedAt && [...card.deckIds].sort().join('\0') !== [...deckIds].sort().join('\0') ? { ...card, deckIds, updatedAt: now } : card) });
        }
        if (note && contentOnly) {
          if (values.onReadings === (note.onReadings?.join('・') ?? '')) value.onReadings = note.onReadings;
          if (values.kunReadings === (note.kunReadings?.join('・') ?? '')) value.kunReadings = note.kunReadings;
          if (values.example === note.example) value.example = note.example;
          if (values.exampleTranslation === note.exampleTranslation) value.exampleTranslation = note.exampleTranslation;
          return updateNoteContent(snapshot, value);
        }
        const cards = [...snapshot.cards];
        for (const direction of ['ja-fr', 'fr-ja'] as const) {
          const old = cards.find(card => card.noteId === id && card.direction === direction && !card.deletedAt)
            ?? cards.find(card => card.noteId === id && card.direction === direction);
          const card: StudyCard = { id: old?.id ?? `${id}:${direction}`, noteId: id, direction, deckIds, updatedAt: now, deletedAt: null };
          if (old) cards[cards.indexOf(old)] = card; else cards.push(card);
        }
        return validateSnapshot({ ...snapshot, notes: note ? snapshot.notes.map(item => item.id === id ? value : item) : [...snapshot.notes, value], cards });
      });
      if (savedNote) baselineNote.current = savedNote;
      baselineDecks.current = [...deckIds].sort().join('\0');
      savedKey.current = JSON.stringify({ values, tags: finalTags, deckIds: [...deckIds].sort(), tagDraft: '' });
      setTags(finalTags); setTagDraft(''); setSaved(true);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save.'); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  guard.current = async () => discarding.current || (!saving.current && (!dirty || await save()));
  async function submit(event: React.FormEvent) { event.preventDefault(); await save(); }
  async function navigate(next?: () => void) { if (next && await guard.current()) next(); }
  function discard() { discarding.current = true; onClose(); }
  const wordFields = <div className="form-columns"><label>Japanese<input required lang="ja" maxLength={1000} placeholder="食べる" {...field('japanese')} /></label><label>Reading <span className="optional">kana</span><input lang="ja" maxLength={1000} placeholder="たべる" {...field('reading')} /></label></div>;
  const readingFields = <details className="reading-fields"><summary>On / kun readings</summary><div className="form-columns"><label>On readings<input lang="ja" maxLength={3600} placeholder="ショク・ジキ" {...field('onReadings')} /></label><label>Kun readings<input lang="ja" maxLength={3600} placeholder="た.べる" {...field('kunReadings')} /></label></div></details>;
  const meaningField = <label>Translation / meaning<input required maxLength={3000} placeholder="To eat" {...field('meaning')} /></label>;
  const exampleFields = <><label>Japanese example<textarea lang="ja" rows={2} maxLength={3000} placeholder="毎日、ご飯を食べます。" {...field('example')} /></label><label>Example translation<input maxLength={3000} placeholder="I eat rice every day." {...field('exampleTranslation')} /></label></>;
  const notesField = <label>{contentOnly ? 'Notes' : 'Explanation / notes'}<textarea rows={contentOnly ? 2 : 3} maxLength={8000} placeholder="Notes" {...field('explanation')} /></label>;
  const tagsField = <TagInput value={tags} onChange={setTags} draft={tagDraft} onDraftChange={setTagDraft} available={availableTags} disabled={busy} />;
  const controls = panel && navigation ? <div className="note-panel-navigation" aria-label="Editor navigation"><span>{navigation.index >= 0 ? `${navigation.index + 1} / ${navigation.total}` : 'Outside current results'}</span><div><button type="button" className="icon-button" aria-label="Previous card" title="Save and open previous card" disabled={busy || !navigation.onPrevious} onClick={() => void navigate(navigation.onPrevious)}><ArrowLeft size={17} /></button><button type="button" className="icon-button" aria-label="Next card" title="Save and open next card" disabled={busy || !navigation.onNext} onClick={() => void navigate(navigation.onNext)}><ArrowRight size={17} /></button></div></div> : null;
  const title = note ? panel || contentOnly ? 'Edit card' : 'Edit note' : 'New note';
  const editor = <form ref={form} className={`editor-form${contentOnly ? ' quick-note-form' : ''}${panel ? ' panel-note-form' : ''}`} onSubmit={submit}>
    <fieldset className="note-form-fields" disabled={busy}>
    {wordFields}
    {contentOnly ? <>{meaningField}{notesField}<details className="quick-note-more"><summary>More fields</summary><div className="quick-note-extra">{readingFields}{exampleFields}{tagsField}</div></details></> : <>{readingFields}{meaningField}{exampleFields}{notesField}{tagsField}</>}
    {!contentOnly && <fieldset className="deck-checkboxes"><legend>Which decks?</legend>{data.decks.filter(deck => !deck.deletedAt).map(deck => <label key={deck.id}><input type="checkbox" checked={deckIds.includes(deck.id)} onChange={event => setDeckIds(previous => event.target.checked ? [...previous, deck.id] : previous.filter(id => id !== deck.id))} /><span className={`deck-dot ${deck.color}`} /><JapaneseText text={path(data, deck)} /></label>)}{!data.decks.some(deck => !deck.deletedAt) && <span className="muted">The note will be available in “All cards”.</span>}</fieldset>}
    </fieldset>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="modal-actions">{panel ? <><span className="note-panel-save-status" role="status">{busy ? 'Saving…' : dirty ? 'Unsaved changes' : saved ? 'Saved' : ''}</span>{dirty && <button type="button" className="text-button" disabled={busy} onClick={discard}>Discard</button>}<button type="button" className="button secondary" disabled={busy} onClick={onClose}>Close</button></> : <button type="button" className="button secondary" onClick={onClose}>Cancel</button>}<button type="submit" disabled={busy || (panel && !dirty)} className="button primary">{busy && <LoaderCircle size={16} className="spin" />}{note ? 'Save' : 'Add note'}</button></div>
  </form>;
  return panel && !smallScreen ? <NotePanel title={title} onClose={onClose} navigation={controls}>{editor}</NotePanel> : <Modal title={title} compact={contentOnly} sheet={panel} onClose={onClose}>{controls}{editor}</Modal>;
}

function path(data: Snapshot, deck: Deck): string {
  const names = [deck.name]; let parent = deck.parentId; const seen = new Set([deck.id]);
  while (parent && !seen.has(parent)) { seen.add(parent); const item = data.decks.find(item => item.id === parent); if (!item) break; names.unshift(item.name); parent = item.parentId; }
  return names.join(' / ');
}
