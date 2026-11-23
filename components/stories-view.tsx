'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, Bookmark, Cat, Check, CloudRain, LoaderCircle, Mail, Moon, Plus, Search, TrainFront, Waves, X } from 'lucide-react';
import { FuriganaToggle, useFuriganaEnabled } from './furigana';
import { splitFurigana } from '@/lib/furigana';
import { sanitizeStoryProgress, storyTitleWords, storyCategoryIds, storyCategoryLabels, storyCategoryText, type Story, type StoryCategory, type StoryProgress, type StoryWord } from '@/lib/stories';
import { scrollWorkspaceTo } from '@/lib/workspace-scroll';
import { StoriesBookshelf } from './stories-bookshelf';
import type { JapaneseFont } from './use-workspace-context';
import type { Snapshot } from '@/lib/model';
import type { StoryFlashcardDraft } from '@/lib/story-flashcards';
import { findDuplicateNote } from '@/lib/note-similarity';
import { deckOptions } from '@/lib/deck-picker';
import './stories.css';

const KEY = 'kotoba-stories-v1';
const coverIcons = { cat: Cat, rain: CloudRain, moon: Moon, train: TrainFront, letter: Mail, sea: Waves };

// These readings are curated with the text; render them immediately, even offline.
function StoryJapanese({ text, reading }: { text: string; reading: string }) {
  const enabled = useFuriganaEnabled();
  if (!enabled) return <>{text}</>;
  return <>{splitFurigana(text, reading).map((part, index) => part.reading
    ? <ruby className="furigana-ruby" key={index}>{part.text}<rp>(</rp><rt>{part.reading}</rt><rp>)</rp></ruby>
    : part.text)}</>;
}

function Cover({ story }: { story: Story }) {
  const Icon = coverIcons[story.theme];
  return <span className={`story-cover story-cover-${story.theme}`} aria-hidden="true">
    <span className="story-cover-series">ことばの物語</span>
    <span className="story-cover-title" lang="ja">{story.title}</span>
    <span className="story-cover-art"><Icon strokeWidth={1.1} /></span>
    <span className="story-cover-bottom">MINI HISTOIRE <span>{story.level}</span></span>
  </span>;
}

type Selection = { word: StoryWord; anchor: HTMLButtonElement; key: string; example: string };
type FlashcardsProps = { flashcards: Snapshot; onAddFlashcard: (draft: StoryFlashcardDraft, deckId: string | null) => Promise<void> };
function Definition({ selection, story, flashcards, deckId, onDeckChange, onAddFlashcard, textStyle, onClose }: FlashcardsProps & { selection: Selection; story: Story; deckId: string; onDeckChange: (id: string) => void; textStyle: CSSProperties; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const options = useMemo(() => deckOptions(flashcards.decks), [flashcards.decks]);
  const selectedDeck = options.some(option => option.id === deckId) ? deckId : '';
  const duplicate = useMemo(() => findDuplicateNote(flashcards, { japanese: selection.word.text, reading: selection.word.reading, meaning: selection.word.meaning }), [flashcards, selection.word]);
  const alreadySaved = !!duplicate && (!selectedDeck || flashcards.cards.filter(card => card.noteId === duplicate.id && !card.deletedAt).every(card => card.deckIds.includes(selectedDeck)));
  async function add() {
    if (busy || alreadySaved) return;
    setBusy(true); setError('');
    try { await onAddFlashcard({ word: selection.word, example: selection.example, story }, selectedDeck || null); setAdded(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer la flashcard. Réessaie.'); }
    finally { setBusy(false); }
  }
  useLayoutEffect(() => {
    function place() {
      if (!panel.current) return;
      const anchor = selection.anchor.getBoundingClientRect();
      const box = panel.current.getBoundingClientRect();
      const view = window.visualViewport;
      const leftEdge = view?.offsetLeft ?? 0;
      const topEdge = view?.offsetTop ?? 0;
      const rightEdge = leftEdge + (view?.width ?? window.innerWidth);
      const bottomEdge = topEdge + (view?.height ?? window.innerHeight);
      const below = anchor.bottom + 10;
      setPosition({
        left: Math.max(leftEdge + 12, Math.min(anchor.left + anchor.width / 2 - box.width / 2, rightEdge - box.width - 12)),
        top: Math.max(topEdge + 12, Math.min(below + box.height < bottomEdge - 12 ? below : anchor.top - box.height - 10, bottomEdge - box.height - 12)),
      });
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !selection.anchor.contains(event.target)) onClose();
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); selection.anchor.focus({ preventScroll: true }); }
    }
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    closeButton.current?.focus({ preventScroll: true });
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keydown);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keydown);
    };
  }, [selection, onClose]);
  return createPortal(<div ref={panel} id="story-definition" role="dialog" aria-label={`Définition de ${selection.word.text}`} className="story-definition" style={{ ...position, ...textStyle }} lang="fr">
    <button ref={closeButton} className="icon-button story-definition-close" aria-label="Fermer la définition" onClick={() => { onClose(); selection.anchor.focus({ preventScroll: true }); }}><X size={17} /></button>
    <strong lang="ja">{selection.word.text}</strong>
    <span className="story-definition-reading" lang="ja">{selection.word.reading}</span>
    <p>{selection.word.meaning}</p>
    <div className="story-flashcard-actions">
      <label><span>Deck</span><select aria-label="Deck de la flashcard" value={selectedDeck} disabled={busy} onChange={event => { onDeckChange(event.target.value); setAdded(false); setError(''); }}><option value="">Sans deck</option>{options.map(option => <option key={option.id} value={option.id}>{option.path}</option>)}</select></label>
      <button type="button" className="story-add-flashcard" aria-busy={busy} disabled={busy || alreadySaved} onClick={() => void add()}>{busy ? <LoaderCircle size={16} className="spin" /> : alreadySaved ? <Check size={16} /> : <Plus size={16} />}<span aria-live="polite">{busy ? 'Enregistrement…' : alreadySaved ? added ? 'Ajoutée' : 'Déjà en flashcard' : duplicate ? 'Ajouter au deck' : 'Ajouter en flashcard'}</span></button>
      {error && <p role="alert" className="story-flashcard-error">{error}</p>}
    </div>
  </div>, document.body);
}

export function StoriesView({ stories, flashcards, defaultFlashcardDeckId, onAddFlashcard, readIds, onReadChange, onMigrateReadIds, japaneseFont, onFontChange, onFuriganaChange }: FlashcardsProps & { stories: readonly Story[]; defaultFlashcardDeckId: string | null; readIds: readonly string[]; onReadChange: (id: string, read: boolean) => Promise<void>; onMigrateReadIds: (ids: readonly string[]) => Promise<void>; japaneseFont: JapaneseFont; onFontChange: (font: JapaneseFont) => void; onFuriganaChange: (enabled: boolean) => void }) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [reading, setReading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'N5' | 'N4' | 'unread'>('all');
  const [category, setCategory] = useState<StoryCategory | 'all'>('all');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [fontSize, setFontSize] = useState(20);
  const [flashcardDeckId, setFlashcardDeckId] = useState(defaultFlashcardDeckId ?? '');
  const closeDefinition = useCallback(() => setSelection(null), []);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shelfFocus = useRef<string | null>(null);
  const enabled = useFuriganaEnabled();
  const textStyle = { '--story-text-scale': fontSize / 20 } as CSSProperties;
  useEffect(() => {
    let disposed = false;
    let legacy: StoryProgress = { currentId: null, readIds: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      legacy = sanitizeStoryProgress(saved, stories);
      setCurrentId(legacy.currentId);
      if (typeof saved?.flashcardDeckId === 'string') setFlashcardDeckId(saved.flashcardDeckId);
      if (Number.isInteger(saved?.fontSize) && saved.fontSize >= 16 && saved.fontSize <= 28) setFontSize(saved.fontSize < 20 ? 18 : saved.fontSize < 24 ? 20 : 24);
    } catch { /* Optional local reading history. */ }
    void onMigrateReadIds(legacy.readIds).then(() => { if (!disposed) setHydrated(true); }).catch(() => { /* Library reports the save failure; retain the original browser flags for retry. */ });
    return () => { disposed = true; };
  }, [stories, onMigrateReadIds]);
  useEffect(() => {
    if (hydrated) try { localStorage.setItem(KEY, JSON.stringify({ currentId, readIds, fontSize, flashcardDeckId })); } catch { /* Optional reading preferences; read status is saved with the library. */ }
  }, [currentId, readIds, fontSize, flashcardDeckId, hydrated]);
  useLayoutEffect(() => {
    if (reading) titleRef.current?.focus({ preventScroll: true });
  }, [reading, currentId]);

  const current = stories.find(story => story.id === currentId);
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const visible = stories.filter(story => (filter === 'all' || filter === 'unread' ? filter !== 'unread' || !readIds.includes(story.id) : story.level === filter)
    && (category === 'all' || story.categories?.includes(category))
    && `${story.title} ${story.reading} ${story.subtitle} ${story.description} ${storyCategoryText(story)}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized));

  function openStory(story: Story, anchor: HTMLButtonElement) {
    shelfFocus.current = anchor.id;
    setCurrentId(story.id);
    setSelection(null); setReading(true); scrollWorkspaceTo(0);
  }
  function back() {
    setSelection(null); setReading(false); scrollWorkspaceTo(0);
    requestAnimationFrame(() => shelfFocus.current && document.getElementById(shelfFocus.current)?.focus({ preventScroll: true }));
  }
  function toggleRead(id: string) {
    void onReadChange(id, !readIds.includes(id)).catch(() => { /* Library reports the error and restores the previous saved status. */ });
  }

  function renderWord(word: StoryWord | string, key: string, example: string) {
    if (typeof word === 'string') return <span key={key}>{word}</span>;
    return <button type="button" key={key} className={`story-word${selection?.key === key ? ' is-selected' : ''}`} aria-label={word.text} aria-haspopup="dialog" aria-expanded={selection?.key === key} aria-controls={selection?.key === key ? 'story-definition' : undefined} onClick={event => setSelection(selection?.key === key ? null : { word, key, example, anchor: event.currentTarget })}><StoryJapanese text={word.text} reading={word.reading} /></button>;
  }

  if (reading && current) {
    const isRead = readIds.includes(current.id);
    return <section className="stories-reader" aria-label={current.subtitle} lang="fr" style={textStyle}>
      <div className="story-reader-toolbar">
        <button className="story-back" aria-label="Retour à la bibliothèque" onClick={back}><ArrowLeft size={20} /><span>Bibliothèque</span></button>
        <div className="story-reader-tools">
          <div className="story-size-control" role="group" aria-label="Taille du texte">
            {([{ size: 18, label: 'Petit' }, { size: 20, label: 'Moyen' }, { size: 24, label: 'Grand' }] as const).map(({ size, label }, index) => <button key={size} aria-label={`Texte ${label.toLowerCase()}`} title={label} aria-pressed={fontSize === size} onClick={() => setFontSize(size)}><span style={{ fontSize: 12 + index * 4 }}>A</span></button>)}
          </div>
          <button className="story-font-switch" role="switch" aria-label="Police manuscrite" aria-checked={japaneseFont === 'brush'} title={japaneseFont === 'brush' ? 'Passer en sans serif' : 'Passer en manuscrit'} onClick={() => onFontChange(japaneseFont === 'plain' ? 'brush' : 'plain')}><span className="story-font-track" aria-hidden="true"><i /></span><span>{japaneseFont === 'plain' ? 'Sans serif' : 'Manuscrit'}</span></button>
          <FuriganaToggle onChange={onFuriganaChange} />
        </div>
      </div>
      <article className={`story-page${enabled ? ' with-readings' : ''}`}>
        <header className="story-page-heading">
          <h2 ref={titleRef} tabIndex={-1} lang="ja">{storyTitleWords(current).map((word, index) => renderWord(word, `title-${index}`, current.title))}</h2>
          <p className="story-reader-meta">{current.level}{current.categories?.length ? ` · ${storyCategoryText(current)}` : ''}</p>
        </header>
        <div className="story-prose" lang="ja">{current.paragraphs.map((paragraph, p) => <p key={p}>{paragraph.map((word, w) => renderWord(word, `body-${p}-${w}`, paragraph.map(part => typeof part === 'string' ? part : part.text).join('')))}</p>)}</div>
        <footer className="story-page-footer"><button className={`story-read-button${isRead ? ' is-read' : ''}`} aria-pressed={isRead} onClick={() => toggleRead(current.id)}><Check size={17} />{isRead ? 'Histoire lue' : 'Marquer comme lue'}</button></footer>
      </article>
      {selection && <Definition key={selection.key} selection={selection} story={current} flashcards={flashcards} deckId={flashcardDeckId} onDeckChange={setFlashcardDeckId} onAddFlashcard={onAddFlashcard} textStyle={textStyle} onClose={closeDefinition} />}
    </section>;
  }

  return <section className="stories-library" aria-label="Bibliothèque d’histoires" lang="fr">
    <header className="stories-heading"><div><h2>Histoires<span lang="ja">物語</span></h2></div><span className="stories-total"><BookOpen size={18} />{stories.length} histoires<span>{readIds.length} lue{readIds.length > 1 ? 's' : ''}</span></span></header>
    {current && <button id="story-resume" className="story-resume" onClick={event => openStory(current, event.currentTarget)}><span className={`story-resume-icon story-cover-${current.theme}`}><Bookmark size={21} /></span><span><small>DERNIÈRE LECTURE</small><strong>{current.subtitle}</strong></span><span className="story-resume-label">Relire</span></button>}
    <div className="stories-tools"><div className="stories-filters" role="group" aria-label="Filtrer les histoires">{(['all', 'N5', 'N4', 'unread'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{({ all: 'Toutes', N5: 'N5 · Débutant', N4: 'N4 · Élémentaire', unread: 'À lire' })[value]}</button>)}</div><div className="stories-discovery"><label className="stories-category-filter"><span className="sr-only">Catégorie des histoires</span><select value={category} onChange={event => setCategory(event.target.value as StoryCategory | "all")}><option value="all">Toutes catégories</option>{storyCategoryIds.map(id => { const count = stories.filter(story => story.categories?.includes(id)).length; return <option key={id} value={id} disabled={!count}>{storyCategoryLabels[id]} · {count}</option>; })}</select></label><label className="stories-search"><Search size={17} /><span className="sr-only">Rechercher une histoire</span><input type="search" placeholder="Rechercher une histoire…" value={query} onChange={event => setQuery(event.target.value)} /></label></div></div>
    <StoriesBookshelf stories={visible} readIds={readIds} onOpen={openStory} />
    <div className="stories-shelf stories-mobile-shelf" aria-label="Histoires disponibles">{visible.map(story => <button key={story.id} id={`story-book-${story.id}`} className="story-book" onClick={event => openStory(story, event.currentTarget)} aria-label={`Lire ${story.subtitle}`}>
      <Cover story={story} />
      <span className="story-book-title">{story.subtitle}</span>
      <span className="story-book-meta">{story.level} · 1 page{readIds.includes(story.id) && <span className="story-book-read"><Check size={13} />Lu</span>}</span>
      {story.categories?.length ? <span className="story-book-categories">{storyCategoryText(story)}</span> : null}
      <span className="story-book-description">{story.description}</span>
    </button>)}</div>
    {!visible.length && <div className="stories-empty"><BookOpen size={30} /><h3>{filter === 'unread' && !query ? 'Toutes les histoires ont été lues !' : 'Aucune histoire trouvée'}</h3><p>Essayez un autre filtre ou une autre recherche.</p><button className="button secondary" onClick={() => { setFilter('all'); setCategory('all'); setQuery(''); }}>Voir toutes les histoires</button></div>}
  </section>;
}
