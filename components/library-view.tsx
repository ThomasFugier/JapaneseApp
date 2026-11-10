'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Eye, EyeOff, Folder, GripVertical, PanelRightClose, PanelRightOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { descendants } from '@/lib/engine';
import type { LibraryAction } from '@/lib/library-actions';
import { deckAncestors, LIBRARY_BATCH_SIZE, libraryDisplayCount, type ReadingContext } from '@/lib/library-view';
import { buildLibraryIndex } from '@/lib/library-index';
import type { Deck, Note, Snapshot } from '@/lib/model';
import { JapaneseText, useFuriganaEnabled } from './furigana';
import { LibraryBulkActions } from './library-bulk-actions';
import './library-view.css';

type Props = {
  data: Snapshot;
  notes: Note[];
  searchPending: boolean;
  searchActions: HTMLElement | null;
  context: ReadingContext;
  onContextChange: (patch: Partial<ReadingContext>) => void;
  editing: boolean;
  onEditingChange: (value: boolean) => void;
  onNewDeck: () => void;
  onEditDeck: (deck: Deck) => void;
  onDeleteDeck: () => void;
  onAddNote: () => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  onReview: (deckId: string | null) => void;
  onBulkAction: (ids: string[], action: LibraryAction) => Promise<void>;
  onMoveDeck: (deckId: string, parentId: string | null) => Promise<void>;
  editor?: ReactNode;
  editingNoteId?: string;
  onCloseEditor: () => void;
};

const TREE_PREFERENCE = 'kotoba-library-tree-v1';
const ALL_BRANCH = '__all__';
type LibraryDrag = { kind: 'cards'; ids: string[] } | { kind: 'deck'; id: string };

export function LibraryView({ data, notes, searchPending, searchActions, context, onContextChange, editing, onEditingChange, onNewDeck, onEditDeck, onDeleteDeck, onAddNote, onEditNote, onDeleteNote, onReview, onBulkAction, onMoveDeck, editor, editingNoteId, onCloseEditor }: Props) {
  const { deckId, search, hideTranslations, expanded } = context;
  const furiganaEnabled = useFuriganaEnabled();
  const decks = data.decks.filter(deck => !deck.deletedAt);
  const roots = decks.filter(deck => !deck.parentId || !decks.some(parent => parent.id === deck.parentId));
  const libraryRoot = roots.length === 1 && ['japonais', 'japanese'].includes(roots[0].name.trim().toLocaleLowerCase('en')) ? roots[0] : undefined;
  const treeDecks = libraryRoot ? decks.filter(deck => deck.id !== libraryRoot.id).map(deck => deck.parentId === libraryRoot.id ? { ...deck, parentId: null } : deck) : decks;
  const selectedDeck = decks.find(deck => deck.id === deckId);
  const index = useMemo(() => buildLibraryIndex(data), [data]);
  const allCount = index.noteIds.size;
  const displayCount = libraryDisplayCount(notes, context.visibleCount, searchPending ? [] : [expanded, editingNoteId]);
  const visibleNotes = useMemo(() => notes.slice(0, displayCount), [notes, displayCount]);
  const entries = useRef<HTMLDivElement>(null);
  const loadingPosition = useRef<{ top: number; previousCount: number } | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileDecksOpen, setMobileDecksOpen] = useState(false);
  const [treeLoaded, setTreeLoaded] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<LibraryDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const drag = useRef<LibraryDrag | null>(null);
  const pending = useRef(false);
  const anchor = useRef<string | null>(null);
  const selected = visibleNotes.filter(note => chosen.has(note.id)).map(note => note.id);
  const mobileDeckButton = useRef<HTMLButtonElement>(null);
  const treeId = useId();
  useEffect(() => {
    if (!searchPending && displayCount > context.visibleCount) onContextChange({ visibleCount: Math.ceil(displayCount / LIBRARY_BATCH_SIZE) * LIBRARY_BATCH_SIZE });
  }, [displayCount, context.visibleCount, searchPending, onContextChange]);
  useLayoutEffect(() => {
    const previous = loadingPosition.current;
    if (!previous) return;
    loadingPosition.current = null;
    if (visibleNotes.length <= previous.previousCount) return;
    entries.current?.querySelectorAll<HTMLButtonElement>('.entry-main')[previous.previousCount]?.focus({ preventScroll: true });
    window.scrollTo({ top: previous.top, behavior: 'instant' });
  }, [visibleNotes.length, context.visibleCount]);
  function loadMore() {
    if (searchPending || visibleNotes.length >= notes.length) return;
    loadingPosition.current = { top: window.scrollY, previousCount: visibleNotes.length };
    onContextChange({ visibleCount: visibleNotes.length + LIBRARY_BATCH_SIZE });
  }
  useEffect(() => {
    if (libraryRoot && deckId === libraryRoot.id) onContextChange({ deckId: null });
  }, [deckId, libraryRoot?.id, onContextChange]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TREE_PREFERENCE) || 'null');
      if (saved && typeof saved === 'object') {
        if (Array.isArray(saved.collapsed)) setCollapsed(new Set(saved.collapsed.slice(0, 10000).filter((id: unknown) => typeof id === 'string' && id.length <= 160)));
        setSidebarHidden(saved.hidden === true);
      }
    } catch { /* Optional display preferences never block the library. */ }
    setTreeLoaded(true);
  }, []);
  useEffect(() => {
    if (!treeLoaded) return;
    try { localStorage.setItem(TREE_PREFERENCE, JSON.stringify({ collapsed: [...collapsed], hidden: sidebarHidden })); } catch { /* The tree remains usable without storage. */ }
  }, [collapsed, sidebarHidden, treeLoaded]);
  useEffect(() => setRevealed(new Set()), [deckId, search, hideTranslations]);
  useEffect(() => { setChosen(new Set()); anchor.current = null; }, [deckId, search, context.sort]);
  useEffect(() => { if (!editing) { setChosen(new Set()); anchor.current = null; } }, [editing]);
  useEffect(() => {
    if (!actionStatus) return;
    const timer = setTimeout(() => setActionStatus(''), 4000);
    return () => clearTimeout(timer);
  }, [actionStatus]);
  useEffect(() => {
    const branch = dropTarget === null ? ALL_BRANCH : dropTarget;
    if (!dragging || branch === undefined || !collapsed.has(branch)) return;
    const timer = setTimeout(() => setCollapsed(previous => { const next = new Set(previous); next.delete(branch); return next; }), 600);
    return () => clearTimeout(timer);
  }, [dropTarget, dragging, collapsed]);

  function selectCard(id: string, checked: boolean, extend = false) {
    const from = visibleNotes.findIndex(note => note.id === anchor.current), to = visibleNotes.findIndex(note => note.id === id);
    const ids = extend && from >= 0 ? visibleNotes.slice(Math.min(from, to), Math.max(from, to) + 1).map(note => note.id) : [id];
    setChosen(previous => { const next = new Set(previous); for (const noteId of ids) checked ? next.add(noteId) : next.delete(noteId); return next; });
    anchor.current = id;
  }
  async function saveAction(ids: string[], action: LibraryAction) {
    if (pending.current) throw new Error('Wait for the current action to finish.');
    pending.current = true; setBusy(true); setActionError(''); setActionStatus('');
    try {
      await onBulkAction(ids, action);
      setChosen(new Set());
      setActionStatus(action.type === 'add-deck' ? `${ids.length} card${ids.length === 1 ? '' : 's'} added to ${decks.find(deck => deck.id === action.deckId)?.name || 'deck'}.` : action.type === 'delete' ? `${ids.length} cards deleted.` : `${ids.length} card${ids.length === 1 ? '' : 's'} updated.`);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Unable to update cards.'); throw cause; }
    finally { pending.current = false; setBusy(false); }
  }
  function endDrag() { drag.current = null; setDragging(null); setDropTarget(undefined); }
  function startDrag(event: DragEvent<HTMLElement>, value: LibraryDrag) {
    if (busy || searchPending) { event.preventDefault(); return; }
    drag.current = value; setDragging(value); setActionError(''); setActionStatus('');
    event.dataTransfer.effectAllowed = value.kind === 'cards' ? 'copyMove' : 'move';
    event.dataTransfer.setData('application/x-japanese-library', JSON.stringify(value));
  }
  function canDrop(id: string | null) {
    const value = drag.current;
    if (!value || busy) return false;
    if (value.kind === 'cards') return id !== null;
    const parent = id ?? libraryRoot?.id ?? null;
    const current = decks.find(deck => deck.id === value.id);
    return !!current && current.parentId !== parent && (parent === null || !descendants(data, value.id).includes(parent));
  }
  function dropProps(id: string | null) {
    return {
      onDragEnter: (event: DragEvent<HTMLElement>) => { if (drag.current) { if (canDrop(id)) event.preventDefault(); setDropTarget(id); } },
      onDragLeave: (event: DragEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(previous => previous === id ? undefined : previous); },
      onDragOver: (event: DragEvent<HTMLElement>) => { if (canDrop(id)) event.preventDefault(); },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault(); event.stopPropagation();
        const value = drag.current, allowed = canDrop(id); endDrag();
        if (!allowed || !value) return;
        if (value.kind === 'cards') { void saveAction(value.ids, { type: 'add-deck', deckId: id! }).catch(() => undefined); return; }
        pending.current = true; setBusy(true); setActionError('');
        void onMoveDeck(value.id, id ?? libraryRoot?.id ?? null).then(() => setActionStatus('Deck moved.')).catch(cause => setActionError(cause instanceof Error ? cause.message : 'Unable to move this deck.')).finally(() => { pending.current = false; setBusy(false); });
      },
    };
  }
  const deckDrag: DeckDragControls = { dragging, dropTarget, canDrop, dropProps, start: (event, id) => startDrag(event, { kind: 'deck', id }), end: endDrag, edit: id => onEditDeck(data.decks.find(deck => deck.id === id)!), busy };
  function selectDeck(id: string | null) {
    if (id) {
      const parents = new Set(deckAncestors(data, id).slice(0, -1).map(deck => deck.id));
      setCollapsed(previous => new Set([...previous].filter(item => item !== ALL_BRANCH && !parents.has(item))));
    }
    if (mobileDecksOpen) mobileDeckButton.current?.focus();
    setMobileDecksOpen(false);
    onContextChange({ deckId: id, search: '', expanded: null, scrollY: 0 });
    onEditingChange(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function reveal(noteId: string) {
    setRevealed(previous => new Set(previous).add(noteId));
  }
  function toggleBranch(id: string) {
    setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  return <section className={`library-page ${editing ? 'is-editing' : ''}`}>
    {/* Keep tree controls beside the shared search without moving their state. */}
    {searchActions && createPortal(<>
      <button className={`button secondary library-deck-toggle ${sidebarHidden || editor ? '' : 'enabled'}`} aria-expanded={!sidebarHidden && !editor} aria-controls={treeId} onClick={() => { if (editor) { setSidebarHidden(false); onCloseEditor(); } else setSidebarHidden(!sidebarHidden); }}>{sidebarHidden || editor ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}Decks</button>
      <button ref={mobileDeckButton} className={`button secondary mobile-deck-toggle ${mobileDecksOpen ? 'enabled' : ''}`} aria-expanded={mobileDecksOpen} aria-controls={treeId} onClick={() => setMobileDecksOpen(!mobileDecksOpen)}><Folder size={17} />Decks<ChevronDown size={13} /></button>
    </>, searchActions)}
    <div className={`library-workspace ${sidebarHidden ? 'decks-hidden' : ''} ${mobileDecksOpen ? 'mobile-decks-open' : ''} ${editor ? 'with-editor' : ''}`}>
      <section className={`dictionary library-dictionary${searchPending ? ' is-searching' : ''}`} aria-label="Deck notes" aria-busy={searchPending}>
        <div className="dictionary-top">
          <div>
            <h2><span className="dictionary-title" title={selectedDeck?.name || 'All cards'}><JapaneseText text={selectedDeck?.name || 'All cards'} /></span><span className="count-bubble">{notes.length}</span></h2>
          </div>
          <div className="dictionary-actions"><button className={`icon-button edit-toggle ${editing ? 'active' : ''}`} title={editing ? 'Finish editing' : 'Edit notes'} aria-label={editing ? 'Finish editing' : 'Edit notes'} aria-pressed={editing} onClick={() => onEditingChange(!editing)}>{editing ? <Check size={17} /> : <Pencil size={17} />}</button><button className="button primary library-review" onClick={() => onReview(deckId)}>Review<ArrowRight size={15} /></button></div>
        </div>
        {editing && <LibraryBulkActions data={data} notes={visibleNotes} selected={selected} deckId={deckId} hiddenRoot={libraryRoot?.id} busy={busy || searchPending} onSelectAll={() => setChosen(selected.length === visibleNotes.length ? new Set() : new Set(visibleNotes.map(note => note.id)))} onClear={() => setChosen(new Set())} onSave={saveAction}>{selectedDeck && <><button className="text-button" onClick={() => onEditDeck(selectedDeck)}>Deck settings</button><button className="icon-button danger-text" aria-label="Delete deck" onClick={onDeleteDeck}><Trash2 size={16} /></button></>}<button className="button small primary" onClick={onAddNote}><Plus size={15} />Add note</button></LibraryBulkActions>}
        {actionError && <p className="library-action-error" role="alert">{actionError}</p>}
        {(actionStatus || dragging) && <p className="library-action-status" role="status">{dragging ? dragging.kind === 'cards' ? `Add ${dragging.ids.length} card${dragging.ids.length === 1 ? '' : 's'} to a deck` : 'Drop on a deck to place it inside' : actionStatus}</p>}
        {selectedDeck && decks.some(deck => deck.parentId === deckId) && <div className="subdeck-chips">{decks.filter(deck => deck.parentId === deckId).map(deck => <button key={deck.id} onClick={() => selectDeck(deck.id)}><span className={`deck-dot ${deck.color}`} /><JapaneseText text={deck.name} /><ChevronRight size={13} /></button>)}</div>}
        <div className="dictionary-labels"><span>JAPANESE</span><span className="translation-heading">TRANSLATION<button className={`translation-toggle ${hideTranslations ? 'enabled' : ''}`} aria-label={hideTranslations ? 'Show translations' : 'Hide translations'} title={hideTranslations ? 'Show translations' : 'Hide translations'} aria-pressed={hideTranslations} onClick={() => onContextChange({ hideTranslations: !hideTranslations })}>{hideTranslations ? <EyeOff size={15} /> : <Eye size={15} />}</button></span><span /></div>
        <div className="entries" ref={entries} inert={searchPending}>{visibleNotes.map(note => {
          const showAnswer = !hideTranslations || revealed.has(note.id);
          const memberships = index.memberships.get(note.id) ?? [];
          const reading = note.reading || [...(note.onReadings ?? []), ...(note.kunReadings ?? [])].join('・');
          return <article className={`dictionary-entry ${expanded === note.id ? 'is-open' : ''} ${chosen.has(note.id) ? 'is-selected' : ''} ${editingNoteId === note.id ? 'is-being-edited' : ''}`} key={note.id}>
            <div className="entry-row">
              {editing && <label className="entry-select"><input type="checkbox" aria-label={`Select ${note.japanese}`} checked={chosen.has(note.id)} disabled={busy} onChange={event => selectCard(note.id, event.target.checked, 'shiftKey' in event.nativeEvent && !!event.nativeEvent.shiftKey)} /></label>}
              <button type="button" className="library-drag-handle card-drag-handle" draggable={!busy} aria-label={`Add ${note.japanese} to a deck`} title="Drag to a deck" disabled={busy} onClick={() => { if (!editing) onEditingChange(true); setChosen(new Set([note.id])); }} onDragStart={event => startDrag(event, { kind: 'cards', ids: chosen.has(note.id) && selected.length ? selected : [note.id] })} onDragEnd={endDrag}><GripVertical size={14} /></button>
              <button className="entry-main" onClick={() => onContextChange({ expanded: expanded === note.id ? null : note.id })} aria-expanded={expanded === note.id}>
                <div className="entry-japanese" lang="ja"><strong className="entry-word"><JapaneseText text={note.japanese} reading={note.reading} /></strong>{!furiganaEnabled && reading && reading !== note.japanese && <span>{reading}</span>}</div>
                <div className="entry-meaning">{showAnswer ? <strong><JapaneseText text={note.meaning} /></strong> : <span className="masked-translation" aria-label="Translation hidden">••••••</span>}</div>
                <ChevronDown size={17} className="entry-chevron" />
              </button>
              {!showAnswer && <button className="icon-button reveal-translation" onClick={() => reveal(note.id)} title="Reveal translation" aria-label={`Reveal translation for ${note.japanese}`}><Eye size={17} /></button>}
              <div className="entry-actions"><button type="button" className="icon-button" title="Edit note" aria-label={`Edit ${note.japanese}`} onClick={() => onEditNote(note)}><Pencil size={15} /></button>{editing && <button className="icon-button danger-text" aria-label={`Delete ${note.japanese}`} onClick={() => onDeleteNote(note)}><Trash2 size={15} /></button>}</div>
            </div>
            {search.trim() && <div className="result-decks">{memberships.length ? memberships.map(deck => <button key={deck.id} title={index.paths.get(deck.id)} onClick={() => selectDeck(deck.id)}><Folder size={11} /><span><JapaneseText text={deck.name} /></span></button>) : <span>No deck</span>}</div>}
            {expanded === note.id && <div className="entry-detail">
              {!!note.tags.length && <div className="entry-tags">{note.tags.map(tag => <span className="tag" key={tag}><JapaneseText text={tag} /></span>)}</div>}
              {note.example && <blockquote><span lang="ja"><JapaneseText text={note.example} /></span>{showAnswer && note.exampleTranslation && <p><JapaneseText text={note.exampleTranslation} /></p>}</blockquote>}
              {(note.onReadings?.length || note.kunReadings?.length) ? <dl className="kanji-readings">{note.onReadings?.length ? <div><dt>ON</dt><dd lang="ja">{note.onReadings.join('・')}</dd></div> : null}{note.kunReadings?.length ? <div><dt>KUN</dt><dd lang="ja">{note.kunReadings.join('・')}</dd></div> : null}</dl> : null}{showAnswer && note.explanation && <p className="explanation"><JapaneseText text={note.explanation} /></p>}
              {!showAnswer && <button className="text-button reveal-detail" onClick={() => reveal(note.id)}><Eye size={15} />Reveal translation</button>}
              {!search.trim() && <div className="entry-memberships">{memberships.map(deck => <button key={deck.id} onClick={() => selectDeck(deck.id)}><Folder size={12} /><JapaneseText text={deck.name} /></button>)}</div>}
            </div>}
          </article>;
        })}</div>
        {!notes.length && !searchPending && <div className="empty-state"><BookOpen size={32} /><h3>{search ? 'No results' : 'No notes'}</h3>{!search && <button className="button primary" onClick={onAddNote}><Plus size={16} />Add note</button>}</div>}
        <div className="dictionary-footer library-pagination"><span role="status" aria-live="polite">{visibleNotes.length < notes.length ? `${visibleNotes.length} of ${notes.length} cards` : `${notes.length} card${notes.length === 1 ? '' : 's'}`}</span>{visibleNotes.length < notes.length && <button type="button" className="button secondary library-load-more" disabled={busy || searchPending} onClick={loadMore}>Load more</button>}</div>
      </section>
      <aside id={treeId} className={`library-decks ${mobileDecksOpen ? 'mobile-open' : ''}`} aria-label="My decks">
        <div className="deck-panel-heading"><h2>Decks</h2><button className="icon-button" aria-label="Create deck" title="Create deck" onClick={onNewDeck}><Plus size={16} /></button></div>
        <nav aria-label="Deck tree"><ul className="deck-tree"><li>
          <div className={`deck-tree-row deck-root ${deckId === null ? 'active' : ''} ${dragging && dropTarget === null && canDrop(null) ? 'is-drop-target' : ''}`} {...dropProps(null)}>
            {treeDecks.length > 0 ? <button className="deck-branch-toggle" aria-label={`${collapsed.has(ALL_BRANCH) ? 'Expand' : 'Collapse'} All cards`} aria-expanded={!collapsed.has(ALL_BRANCH)} aria-controls={`${treeId}-all`} onClick={() => toggleBranch(ALL_BRANCH)}><ChevronRight size={14} className={collapsed.has(ALL_BRANCH) ? '' : 'is-expanded'} /></button> : <span className="deck-branch-spacer" />}
            <button className="deck-select" aria-current={deckId === null ? 'page' : undefined} onClick={() => selectDeck(null)}><BookOpen size={15} /><span>All cards</span><small>{allCount}</small></button>
          </div>
          <DeckTree decks={treeDecks} selected={deckId} collapsed={collapsed} onToggle={toggleBranch} onSelect={selectDeck} treeId={treeId} id={`${treeId}-all`} hidden={collapsed.has(ALL_BRANCH)} drag={deckDrag} />
        </li></ul></nav>
      </aside>
      {editor && <aside className="library-editor" aria-label="Card editor">{editor}</aside>}
    </div>
  </section>;
}

type DeckDragControls = { dragging: LibraryDrag | null; dropTarget: string | null | undefined; canDrop: (id: string | null) => boolean; dropProps: (id: string | null) => object; start: (event: DragEvent<HTMLElement>, id: string) => void; end: () => void; edit: (id: string) => void; busy: boolean };

function DeckTree({ decks, selected, collapsed, onToggle, onSelect, treeId, parent = null, visited = [], id, hidden = false, drag }: { decks: Deck[]; selected: string | null; collapsed: Set<string>; onToggle: (id: string) => void; onSelect: (id: string) => void; treeId: string; parent?: string | null; visited?: string[]; id?: string; hidden?: boolean; drag: DeckDragControls }) {
  const children = decks.filter(deck => !visited.includes(deck.id) && (parent === null ? !deck.parentId || !decks.some(item => item.id === deck.parentId) : deck.parentId === parent));
  return <ul className="deck-children" id={id} hidden={hidden}>{!hidden && children.map(deck => {
    const hasChildren = decks.some(child => child.parentId === deck.id && !visited.includes(child.id) && child.id !== deck.id);
    const folded = collapsed.has(deck.id);
    const childId = `${treeId}-branch-${encodeURIComponent(deck.id)}`;
    return <li key={deck.id}>
      <div className={`deck-tree-row ${selected === deck.id ? 'active' : ''} ${drag.dragging && drag.dropTarget === deck.id && drag.canDrop(deck.id) ? 'is-drop-target' : ''} ${drag.dragging?.kind === 'deck' && drag.dragging.id === deck.id ? 'is-dragging' : ''}`} {...drag.dropProps(deck.id)}>
        {hasChildren ? <button className="deck-branch-toggle" aria-label={`${folded ? 'Expand' : 'Collapse'} ${deck.name}`} aria-expanded={!folded} aria-controls={childId} onClick={() => onToggle(deck.id)}><ChevronRight size={14} className={folded ? '' : 'is-expanded'} /></button> : <span className="deck-branch-spacer" />}
        <button className="deck-select" aria-current={selected === deck.id ? 'page' : undefined} title={deck.name} onClick={() => onSelect(deck.id)}><Folder size={15} /><span><JapaneseText text={deck.name} /></span></button>
        <button type="button" className="library-drag-handle deck-drag-handle" draggable={!drag.busy} disabled={drag.busy} aria-label={`Move ${deck.name}`} title="Drag to move deck" onClick={() => drag.edit(deck.id)} onDragStart={event => drag.start(event, deck.id)} onDragEnd={drag.end}><GripVertical size={13} /></button>
      </div>
      {hasChildren && <DeckTree decks={decks} selected={selected} collapsed={collapsed} onToggle={onToggle} onSelect={onSelect} treeId={treeId} parent={deck.id} visited={[...visited, deck.id]} id={childId} hidden={folded} drag={drag} />}
    </li>;
  })}</ul>;
}

export default LibraryView;
