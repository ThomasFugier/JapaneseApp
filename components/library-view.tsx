'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, Eye, EyeOff, Folder, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { cardsForDeck } from '@/lib/engine';
import { deckAncestors, libraryNotes, noteDecks, type ReadingContext } from '@/lib/library-view';
import type { Deck, Note, Snapshot } from '@/lib/model';
import './library-view.css';

type Props = {
  data: Snapshot;
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
};

export function LibraryView({ data, context, onContextChange, editing, onEditingChange, onNewDeck, onEditDeck, onDeleteDeck, onAddNote, onEditNote, onDeleteNote, onReview }: Props) {
  const { deckId, search, sort, scope, hideTranslations, expanded } = context;
  const decks = data.decks.filter(deck => !deck.deletedAt);
  const selectedDeck = decks.find(deck => deck.id === deckId);
  const ancestors = selectedDeck ? deckAncestors(data, selectedDeck.id) : [];
  const parent = ancestors.at(-2);
  const notes = useMemo(() => libraryNotes(data, context), [data, context]);
  const allCount = new Set(cardsForDeck(data, null).map(card => card.noteId)).size;
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  useEffect(() => setRevealed(new Set()), [deckId, search, hideTranslations]);
  function selectDeck(id: string | null) {
    onContextChange({ deckId: id, search: '', scope: 'deck', expanded: null, scrollY: 0 });
    onEditingChange(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function reveal(noteId: string) {
    setRevealed(previous => new Set(previous).add(noteId));
  }
  return <>
    <div className="page-heading"><h1>Bibliothèque</h1><button className="button secondary" onClick={onNewDeck}><Plus size={17} />Nouveau deck</button></div>
    <div className="library-layout">
      <aside className="deck-browser">
        <button className={`all-decks ${deckId === null ? 'active' : ''}`} onClick={() => selectDeck(null)}><BookOpen size={17} />Toutes les fiches<span>{allCount}</span></button>
        <div className="sidebar-label">MES DECKS</div>
        <DeckTree data={data} selected={deckId} onSelect={selectDeck} />
        <button className="add-deck" onClick={onNewDeck}><Plus size={16} />Ajouter un deck</button>
      </aside>
      <section className="dictionary">
        {selectedDeck && <button className="text-button mobile-parent-link" onClick={() => selectDeck(parent?.id ?? null)} aria-label={`Retour à ${parent?.name ?? 'Toutes les fiches'}`}><ArrowLeft size={15} />{parent?.name ?? 'Toutes les fiches'}</button>}
        <div className="dictionary-top">
          <div>
            <nav className="breadcrumb reading-breadcrumb" aria-label="Chemin du deck"><button onClick={() => selectDeck(null)} aria-current={!selectedDeck ? 'page' : undefined}>Toutes les fiches</button>{ancestors.map((deck, index) => <span key={deck.id}><ChevronRight size={11} /><button onClick={() => selectDeck(deck.id)} aria-current={index === ancestors.length - 1 ? 'page' : undefined}>{deck.name}</button></span>)}</nav>
            <h2>{scope === 'all' ? search.trim() ? 'Résultats dans tous les decks' : 'Toutes les fiches' : selectedDeck?.name || 'Toutes les fiches'} <span className="count-bubble">{notes.length}</span></h2>
          </div>
          <button className={`icon-button edit-toggle ${editing ? 'active' : ''}`} title={editing ? 'Terminer l’édition' : 'Modifier le deck'} aria-label={editing ? 'Terminer l’édition' : 'Modifier le deck'} onClick={() => onEditingChange(!editing)}>{editing ? <Check size={16} /> : <Pencil size={15} />}<span>{editing ? 'Terminer' : 'Modifier'}</span></button>
        </div>
        {editing && <div className="edit-toolbar"><span><Pencil size={14} />Mode édition</span><div>{selectedDeck && <><button className="text-button" onClick={() => onEditDeck(selectedDeck)}>Réglages du deck</button><button className="icon-button danger-text" aria-label="Supprimer le deck" onClick={onDeleteDeck}><Trash2 size={16} /></button></>}<button className="button small primary" onClick={onAddNote}><Plus size={15} />Ajouter une fiche</button></div></div>}
        <div className="dictionary-controls">
          <label className="search-field"><Search size={18} /><input id="library-search" type="search" placeholder="Mot, lecture ou romaji…" value={search} onChange={event => onContextChange({ search: event.target.value, expanded: null, scrollY: 0 })} aria-label="Rechercher des fiches" /></label>
          <button className="button secondary small" onClick={() => onReview(scope === 'all' ? null : deckId)}><Layers size={16} />Réviser</button>
        </div>
        <div className="reading-tools">
          <label className="reading-select"><span>Recherche</span><select value={scope} onChange={event => onContextChange({ scope: event.target.value as ReadingContext['scope'], scrollY: 0 })} aria-label="Portée de la recherche"><option value="deck">{selectedDeck ? 'Ce deck' : 'Toutes les fiches'}</option><option value="all">Tous les decks</option></select></label>
          <label className="reading-select"><span>Tri</span><select value={sort} onChange={event => onContextChange({ sort: event.target.value as ReadingContext['sort'], scrollY: 0 })} aria-label="Trier les fiches"><option value="japanese">Japonais</option><option value="meaning">Traduction</option><option value="added">Date d’ajout</option></select></label>
          <button className={`button secondary small hide-translations ${hideTranslations ? 'enabled' : ''}`} aria-pressed={hideTranslations} onClick={() => onContextChange({ hideTranslations: !hideTranslations })}>{hideTranslations ? <EyeOff size={15} /> : <Eye size={15} />}<span>{hideTranslations ? 'Traductions masquées' : 'Masquer les traductions'}</span></button>
        </div>
        {selectedDeck && decks.some(deck => deck.parentId === deckId) && <div className="subdeck-chips">{decks.filter(deck => deck.parentId === deckId).map(deck => <button key={deck.id} onClick={() => selectDeck(deck.id)}><span className={`deck-dot ${deck.color}`} />{deck.name}<ChevronRight size={13} /></button>)}</div>}
        <div className="dictionary-labels"><span>JAPONAIS</span><span>TRADUCTION</span><span /></div>
        <div className="entries">{notes.map(note => {
          const showAnswer = !hideTranslations || revealed.has(note.id);
          const memberships = noteDecks(data, note.id);
          return <article className={`dictionary-entry ${expanded === note.id ? 'is-open' : ''}`} key={note.id}>
            <div className="entry-row">
              <button className="entry-main" onClick={() => onContextChange({ expanded: expanded === note.id ? null : note.id })} aria-expanded={expanded === note.id}>
                <div className="entry-japanese" lang="ja">{note.japanese}<span>{note.reading || [...(note.onReadings ?? []), ...(note.kunReadings ?? [])].join('・')}</span></div>
                <div className="entry-meaning">{showAnswer ? <strong>{note.meaning}</strong> : <span className="masked-translation" aria-label="Traduction masquée">••••••</span>}<div>{note.tags.slice(0, 3).map(tag => <span className="tag" key={tag}>{tag}</span>)}</div></div>
                <ChevronDown size={17} className="entry-chevron" />
              </button>
              {!showAnswer && <button className="icon-button reveal-translation" onClick={() => reveal(note.id)} title="Révéler la traduction" aria-label={`Révéler la traduction de ${note.japanese}`}><Eye size={17} /></button>}
              {editing && <div className="entry-actions"><button className="icon-button" aria-label={`Modifier ${note.japanese}`} onClick={() => onEditNote(note)}><Pencil size={15} /></button><button className="icon-button danger-text" aria-label={`Supprimer ${note.japanese}`} onClick={() => onDeleteNote(note)}><Trash2 size={15} /></button></div>}
            </div>
            {(scope === 'all' || search.trim()) && <div className="result-decks">{memberships.length ? memberships.map(deck => <button key={deck.id} onClick={() => selectDeck(deck.id)}><Folder size={12} /><span>{deckAncestors(data, deck.id).map(item => item.name).join(' / ')}</span><ChevronRight size={11} /></button>) : <span>Sans deck</span>}</div>}
            {expanded === note.id && <div className="entry-detail">
              {note.example && <blockquote><span lang="ja">{note.example}</span>{showAnswer && note.exampleTranslation && <p>{note.exampleTranslation}</p>}</blockquote>}
              {(note.onReadings?.length || note.kunReadings?.length) ? <dl className="kanji-readings">{note.onReadings?.length ? <div><dt>ON</dt><dd lang="ja">{note.onReadings.join('・')}</dd></div> : null}{note.kunReadings?.length ? <div><dt>KUN</dt><dd lang="ja">{note.kunReadings.join('・')}</dd></div> : null}</dl> : null}{showAnswer && note.explanation && <p className="explanation">{note.explanation}</p>}
              {!showAnswer && <button className="text-button reveal-detail" onClick={() => reveal(note.id)}><Eye size={15} />Révéler la traduction</button>}
              {scope !== 'all' && !search.trim() && <div className="entry-memberships">{memberships.map(deck => <button key={deck.id} onClick={() => selectDeck(deck.id)}><Folder size={12} />{deck.name}</button>)}</div>}
            </div>}
          </article>;
        })}</div>
        {!notes.length && <div className="empty-state"><BookOpen size={32} /><h3>{search ? 'Aucun résultat' : 'Aucune fiche'}</h3>{!search && <button className="button primary" onClick={onAddNote}><Plus size={16} />Ajouter une fiche</button>}</div>}
        <div className="dictionary-footer"><span>{notes.length} fiche{notes.length > 1 ? 's' : ''}</span></div>
      </section>
    </div>
  </>;
}

function DeckTree({ data, selected, onSelect, parent = null, depth = 0, visited = [] }: { data: Snapshot; selected: string | null; onSelect: (id: string) => void; parent?: string | null; depth?: number; visited?: string[] }) {
  const active = data.decks.filter(deck => !deck.deletedAt);
  return <div className="deck-tree">{active.filter(deck => !visited.includes(deck.id) && (parent === null ? !deck.parentId || !active.some(item => item.id === deck.parentId) : deck.parentId === parent)).map(deck => <div key={deck.id}>
    <button style={{ paddingLeft: 12 + depth * 13 }} className={`tree-item ${selected === deck.id ? 'active' : ''}`} onClick={() => onSelect(deck.id)}><span className={`deck-dot ${deck.color}`} /><span>{deck.name}</span>{active.some(child => child.parentId === deck.id) && <ChevronDown size={12} />}</button>
    <DeckTree data={data} selected={selected} onSelect={onSelect} parent={deck.id} depth={depth + 1} visited={[...visited, deck.id]} />
  </div>)}</div>;
}

export default LibraryView;
