'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Eye, EyeOff, Folder, PanelRightClose, PanelRightOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { cardsForDeck } from '@/lib/engine';
import { deckAncestors, libraryNotes, noteDecks, type ReadingContext } from '@/lib/library-view';
import type { Deck, Note, Snapshot } from '@/lib/model';
import { JapaneseFontToggle } from './japanese-font-toggle';
import type { JapaneseFont } from './use-workspace-context';
import './library-view.css';

type Props = {
  data: Snapshot;
  searchActions: HTMLElement | null;
  context: ReadingContext;
  onContextChange: (patch: Partial<ReadingContext>) => void;
  japaneseFont: JapaneseFont;
  onJapaneseFontChange: (value: JapaneseFont) => void;
  editing: boolean;
  onEditingChange: (value: boolean) => void;
  onNewDeck: () => void;
  onEditDeck: (deck: Deck) => void;
  onDeleteDeck: () => void;
  onAddNote: () => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  onReview: (deckId: string | null) => void;
};

const TREE_PREFERENCE = 'kotoba-library-tree-v1';
const ALL_BRANCH = '__all__';

export function LibraryView({ data, searchActions, context, onContextChange, japaneseFont, onJapaneseFontChange, editing, onEditingChange, onNewDeck, onEditDeck, onDeleteDeck, onAddNote, onEditNote, onDeleteNote, onReview }: Props) {
  const { deckId, search, hideTranslations, expanded } = context;
  const decks = data.decks.filter(deck => !deck.deletedAt);
  const roots = decks.filter(deck => !deck.parentId || !decks.some(parent => parent.id === deck.parentId));
  const libraryRoot = roots.length === 1 && ['japonais', 'japanese'].includes(roots[0].name.trim().toLocaleLowerCase('en')) ? roots[0] : undefined;
  const treeDecks = libraryRoot ? decks.filter(deck => deck.id !== libraryRoot.id).map(deck => deck.parentId === libraryRoot.id ? { ...deck, parentId: null } : deck) : decks;
  const selectedDeck = decks.find(deck => deck.id === deckId);
  const notes = useMemo(() => libraryNotes(data, context), [data, context]);
  const allCount = new Set(cardsForDeck(data, null).map(card => card.noteId)).size;
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileDecksOpen, setMobileDecksOpen] = useState(false);
  const [treeLoaded, setTreeLoaded] = useState(false);
  const mobileDeckButton = useRef<HTMLButtonElement>(null);
  const treeId = useId();
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
  return <section className="library-page">
    {/* Keep tree controls beside the shared search without moving their state. */}
    {searchActions && createPortal(<>
      <button className={`button secondary library-deck-toggle ${sidebarHidden ? '' : 'enabled'}`} aria-expanded={!sidebarHidden} aria-controls={treeId} onClick={() => setSidebarHidden(!sidebarHidden)}>{sidebarHidden ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}Decks</button>
      <button ref={mobileDeckButton} className={`button secondary mobile-deck-toggle ${mobileDecksOpen ? 'enabled' : ''}`} aria-expanded={mobileDecksOpen} aria-controls={treeId} onClick={() => setMobileDecksOpen(!mobileDecksOpen)}><Folder size={17} />Decks<ChevronDown size={13} /></button>
    </>, searchActions)}
    <div className={`library-workspace ${sidebarHidden ? 'decks-hidden' : ''} ${mobileDecksOpen ? 'mobile-decks-open' : ''}`}>
      <section className="dictionary library-dictionary" aria-label="Deck notes">
        <div className="dictionary-top">
          <div>
            <h2>{selectedDeck?.name || 'All notes'} <span className="count-bubble">{notes.length}</span></h2>
          </div>
          <div className="dictionary-actions"><button className={`icon-button edit-toggle ${editing ? 'active' : ''}`} title={editing ? 'Finish editing' : 'Edit notes'} aria-label={editing ? 'Finish editing' : 'Edit notes'} aria-pressed={editing} onClick={() => onEditingChange(!editing)}>{editing ? <Check size={17} /> : <Pencil size={17} />}</button><button className="button primary library-review" onClick={() => onReview(deckId)}>Review<ArrowRight size={15} /></button></div>
        </div>
        {editing && <div className="edit-toolbar"><span><Pencil size={14} />Editing mode</span><div>{selectedDeck && <><button className="text-button" onClick={() => onEditDeck(selectedDeck)}>Deck settings</button><button className="icon-button danger-text" aria-label="Delete deck" onClick={onDeleteDeck}><Trash2 size={16} /></button></>}<button className="button small primary" onClick={onAddNote}><Plus size={15} />Add note</button></div></div>}
        {selectedDeck && decks.some(deck => deck.parentId === deckId) && <div className="subdeck-chips">{decks.filter(deck => deck.parentId === deckId).map(deck => <button key={deck.id} onClick={() => selectDeck(deck.id)}><span className={`deck-dot ${deck.color}`} />{deck.name}<ChevronRight size={13} /></button>)}</div>}
        <div className="dictionary-labels"><span className="japanese-heading">JAPANESE<JapaneseFontToggle value={japaneseFont} onChange={onJapaneseFontChange} /></span><span className="translation-heading">TRANSLATION<button className={`translation-toggle ${hideTranslations ? 'enabled' : ''}`} aria-label={hideTranslations ? 'Show translations' : 'Hide translations'} title={hideTranslations ? 'Show translations' : 'Hide translations'} aria-pressed={hideTranslations} onClick={() => onContextChange({ hideTranslations: !hideTranslations })}>{hideTranslations ? <EyeOff size={15} /> : <Eye size={15} />}</button></span><span /></div>
        <div className="entries">{notes.map(note => {
          const showAnswer = !hideTranslations || revealed.has(note.id);
          const memberships = noteDecks(data, note.id);
          const reading = note.reading || [...(note.onReadings ?? []), ...(note.kunReadings ?? [])].join('・');
          return <article className={`dictionary-entry ${expanded === note.id ? 'is-open' : ''}`} key={note.id}>
            <div className="entry-row">
              <button className="entry-main" onClick={() => onContextChange({ expanded: expanded === note.id ? null : note.id })} aria-expanded={expanded === note.id}>
                <div className="entry-japanese" lang="ja"><strong className="entry-word">{note.japanese}</strong>{reading && reading !== note.japanese && <span>{reading}</span>}</div>
                <div className="entry-meaning">{showAnswer ? <strong>{note.meaning}</strong> : <span className="masked-translation" aria-label="Translation hidden">••••••</span>}</div>
                <ChevronDown size={17} className="entry-chevron" />
              </button>
              {!showAnswer && <button className="icon-button reveal-translation" onClick={() => reveal(note.id)} title="Reveal translation" aria-label={`Reveal translation for ${note.japanese}`}><Eye size={17} /></button>}
              {editing && <div className="entry-actions"><button className="icon-button" aria-label={`Edit ${note.japanese}`} onClick={() => onEditNote(note)}><Pencil size={15} /></button><button className="icon-button danger-text" aria-label={`Delete ${note.japanese}`} onClick={() => onDeleteNote(note)}><Trash2 size={15} /></button></div>}
            </div>
            {search.trim() && <div className="result-decks">{memberships.length ? memberships.map(deck => <button key={deck.id} title={deckAncestors(data, deck.id).map(item => item.name).join(' / ')} onClick={() => selectDeck(deck.id)}><Folder size={11} /><span>{deck.name}</span></button>) : <span>No deck</span>}</div>}
            {expanded === note.id && <div className="entry-detail">
              {!!note.tags.length && <div className="entry-tags">{note.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>}
              {note.example && <blockquote><span lang="ja">{note.example}</span>{showAnswer && note.exampleTranslation && <p>{note.exampleTranslation}</p>}</blockquote>}
              {(note.onReadings?.length || note.kunReadings?.length) ? <dl className="kanji-readings">{note.onReadings?.length ? <div><dt>ON</dt><dd lang="ja">{note.onReadings.join('・')}</dd></div> : null}{note.kunReadings?.length ? <div><dt>KUN</dt><dd lang="ja">{note.kunReadings.join('・')}</dd></div> : null}</dl> : null}{showAnswer && note.explanation && <p className="explanation">{note.explanation}</p>}
              {!showAnswer && <button className="text-button reveal-detail" onClick={() => reveal(note.id)}><Eye size={15} />Reveal translation</button>}
              {!search.trim() && <div className="entry-memberships">{memberships.map(deck => <button key={deck.id} onClick={() => selectDeck(deck.id)}><Folder size={12} />{deck.name}</button>)}</div>}
            </div>}
          </article>;
        })}</div>
        {!notes.length && <div className="empty-state"><BookOpen size={32} /><h3>{search ? 'No results' : 'No notes'}</h3>{!search && <button className="button primary" onClick={onAddNote}><Plus size={16} />Add note</button>}</div>}
        <div className="dictionary-footer"><span>{notes.length} note{notes.length === 1 ? '' : 's'}</span></div>
      </section>
      <aside id={treeId} className={`library-decks ${mobileDecksOpen ? 'mobile-open' : ''}`} aria-label="My decks">
        <div className="deck-panel-heading"><h2>Decks</h2><button className="icon-button" aria-label="Create deck" title="Create deck" onClick={onNewDeck}><Plus size={16} /></button></div>
        <nav aria-label="Deck tree"><ul className="deck-tree"><li>
          <div className={`deck-tree-row deck-root ${deckId === null ? 'active' : ''}`}>
            {treeDecks.length > 0 ? <button className="deck-branch-toggle" aria-label={`${collapsed.has(ALL_BRANCH) ? 'Expand' : 'Collapse'} All notes`} aria-expanded={!collapsed.has(ALL_BRANCH)} aria-controls={`${treeId}-all`} onClick={() => toggleBranch(ALL_BRANCH)}><ChevronRight size={14} className={collapsed.has(ALL_BRANCH) ? '' : 'is-expanded'} /></button> : <span className="deck-branch-spacer" />}
            <button className="deck-select" aria-current={deckId === null ? 'page' : undefined} onClick={() => selectDeck(null)}><BookOpen size={15} /><span>All notes</span><small>{allCount}</small></button>
          </div>
          <DeckTree decks={treeDecks} selected={deckId} collapsed={collapsed} onToggle={toggleBranch} onSelect={selectDeck} treeId={treeId} id={`${treeId}-all`} hidden={collapsed.has(ALL_BRANCH)} />
        </li></ul></nav>
      </aside>
    </div>
  </section>;
}

function DeckTree({ decks, selected, collapsed, onToggle, onSelect, treeId, parent = null, visited = [], id, hidden = false }: { decks: Deck[]; selected: string | null; collapsed: Set<string>; onToggle: (id: string) => void; onSelect: (id: string) => void; treeId: string; parent?: string | null; visited?: string[]; id?: string; hidden?: boolean }) {
  const children = decks.filter(deck => !visited.includes(deck.id) && (parent === null ? !deck.parentId || !decks.some(item => item.id === deck.parentId) : deck.parentId === parent));
  return <ul className="deck-children" id={id} hidden={hidden}>{!hidden && children.map(deck => {
    const hasChildren = decks.some(child => child.parentId === deck.id && !visited.includes(child.id) && child.id !== deck.id);
    const folded = collapsed.has(deck.id);
    const childId = `${treeId}-branch-${encodeURIComponent(deck.id)}`;
    return <li key={deck.id}>
      <div className={`deck-tree-row ${selected === deck.id ? 'active' : ''}`}>
        {hasChildren ? <button className="deck-branch-toggle" aria-label={`${folded ? 'Expand' : 'Collapse'} ${deck.name}`} aria-expanded={!folded} aria-controls={childId} onClick={() => onToggle(deck.id)}><ChevronRight size={14} className={folded ? '' : 'is-expanded'} /></button> : <span className="deck-branch-spacer" />}
        <button className="deck-select" aria-current={selected === deck.id ? 'page' : undefined} title={deck.name} onClick={() => onSelect(deck.id)}><Folder size={15} /><span>{deck.name}</span></button>
      </div>
      {hasChildren && <DeckTree decks={decks} selected={selected} collapsed={collapsed} onToggle={onToggle} onSelect={onSelect} treeId={treeId} parent={deck.id} visited={[...visited, deck.id]} id={childId} hidden={folded} />}
    </li>;
  })}</ul>;
}

export default LibraryView;
