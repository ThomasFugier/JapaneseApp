'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, Bookmark, Cat, Check, CloudRain, Mail, Moon, Search, TrainFront, Waves, X } from 'lucide-react';
import { FuriganaToggle, useFuriganaEnabled } from './furigana';
import { splitFurigana } from '@/lib/furigana';
import { sanitizeStoryProgress, type Story, type StoryProgress, type StoryWord } from '@/lib/stories';
import { scrollWorkspaceTo } from '@/lib/workspace-scroll';
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

type Selection = { word: StoryWord; anchor: HTMLButtonElement; key: string };
function Definition({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
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
    closeButton.current?.focus({ preventScroll: true });
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keydown);
    };
  }, [selection, onClose]);
  return createPortal(<div ref={panel} id="story-definition" role="dialog" aria-label={`Définition de ${selection.word.text}`} className="story-definition" style={position} lang="fr">
    <button ref={closeButton} className="icon-button story-definition-close" aria-label="Fermer la définition" onClick={() => { onClose(); selection.anchor.focus({ preventScroll: true }); }}><X size={17} /></button>
    <span className="story-definition-label">DÉFINITION</span>
    <strong lang="ja">{selection.word.text}</strong>
    <span className="story-definition-reading" lang="ja">{selection.word.reading}</span>
    <p>{selection.word.meaning}</p>
  </div>, document.body);
}

export function StoriesView({ stories, onFuriganaChange }: { stories: readonly Story[]; onFuriganaChange: (enabled: boolean) => void }) {
  const [progress, setProgress] = useState<StoryProgress>({ currentId: null, readIds: [] });
  const [hydrated, setHydrated] = useState(false);
  const [reading, setReading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'N5' | 'N4' | 'unread'>('all');
  const [selection, setSelection] = useState<Selection | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shelfFocus = useRef<string | null>(null);
  const enabled = useFuriganaEnabled();
  useEffect(() => {
    try { setProgress(sanitizeStoryProgress(JSON.parse(localStorage.getItem(KEY) || 'null'), stories)); } catch { /* Optional local reading history. */ }
    setHydrated(true);
  }, [stories]);
  useEffect(() => {
    if (hydrated) try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* Reading remains available without storage. */ }
  }, [progress, hydrated]);
  useLayoutEffect(() => {
    if (reading) titleRef.current?.focus({ preventScroll: true });
  }, [reading, progress.currentId]);

  const current = stories.find(story => story.id === progress.currentId);
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const visible = stories.filter(story => (filter === 'all' || filter === 'unread' ? filter !== 'unread' || !progress.readIds.includes(story.id) : story.level === filter)
    && `${story.title} ${story.reading} ${story.subtitle} ${story.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized));

  function openStory(story: Story, anchor: HTMLButtonElement) {
    shelfFocus.current = anchor.id;
    setProgress(previous => ({ ...previous, currentId: story.id }));
    setSelection(null); setReading(true); scrollWorkspaceTo(0);
  }
  function back() {
    setSelection(null); setReading(false); scrollWorkspaceTo(0);
    requestAnimationFrame(() => shelfFocus.current && document.getElementById(shelfFocus.current)?.focus({ preventScroll: true }));
  }
  function toggleRead(id: string) {
    setProgress(previous => ({ ...previous, readIds: previous.readIds.includes(id) ? previous.readIds.filter(item => item !== id) : [...previous.readIds, id] }));
  }

  if (reading && current) {
    const isRead = progress.readIds.includes(current.id);
    return <section className="stories-reader" aria-label={current.subtitle} lang="fr">
      <div className="story-reader-toolbar"><button className="story-back" onClick={back}><ArrowLeft size={17} />Bibliothèque</button><FuriganaToggle onChange={onFuriganaChange} /></div>
      <article className={`story-page${enabled ? ' with-readings' : ''}`}>
        <header className="story-page-heading">
          <span className="story-kicker">{current.level} · MINI HISTOIRE · 1 PAGE</span>
          <h2 ref={titleRef} tabIndex={-1} lang="ja"><StoryJapanese text={current.title} reading={current.reading} /></h2>
          <p>{current.subtitle}</p>
          <span className="story-page-ornament" aria-hidden="true">✦</span>
        </header>
        <p className="story-reading-tip"><BookOpen size={15} />Touchez un mot pour découvrir son sens.</p>
        <div className="story-prose" lang="ja">{current.paragraphs.map((paragraph, p) => <p key={p}>{paragraph.map((word, w) => {
          if (typeof word === 'string') return <span key={w}>{word}</span>;
          const key = `${p}-${w}`;
          return <button type="button" key={key} className={`story-word${selection?.key === key ? ' is-selected' : ''}`} aria-label={word.text} aria-haspopup="dialog" aria-expanded={selection?.key === key} aria-controls={selection?.key === key ? 'story-definition' : undefined} onClick={event => setSelection(selection?.key === key ? null : { word, key, anchor: event.currentTarget })}><StoryJapanese text={word.text} reading={word.reading} /></button>;
        })}</p>)}</div>
        <footer className="story-page-footer"><span>おわり</span><button className={`story-read-button${isRead ? ' is-read' : ''}`} aria-pressed={isRead} onClick={() => toggleRead(current.id)}><Check size={17} />{isRead ? 'Histoire lue' : 'Marquer comme lue'}</button></footer>
      </article>
      <button className="story-back story-bottom-back" onClick={back}><ArrowLeft size={16} />Choisir une autre histoire</button>
      {selection && <Definition selection={selection} onClose={() => setSelection(null)} />}
    </section>;
  }

  return <section className="stories-library" aria-label="Bibliothèque d’histoires" lang="fr">
    <header className="stories-heading"><div><span className="story-kicker">UN PEU DE JAPONAIS, CHAQUE JOUR</span><h2>Histoires<span lang="ja">物語</span></h2><p>Une page, un petit voyage. Lisez à votre rythme.</p></div><span className="stories-total"><BookOpen size={18} />{stories.length} histoires<span>{progress.readIds.length} lue{progress.readIds.length > 1 ? 's' : ''}</span></span></header>
    {current && <button id="story-resume" className="story-resume" onClick={event => openStory(current, event.currentTarget)}><span className={`story-resume-icon story-cover-${current.theme}`}><Bookmark size={21} /></span><span><small>DERNIÈRE LECTURE</small><strong>{current.subtitle}</strong></span><span className="story-resume-label">Relire</span></button>}
    <div className="stories-tools"><div className="stories-filters" role="group" aria-label="Filtrer les histoires">{(['all', 'N5', 'N4', 'unread'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{({ all: 'Toutes', N5: 'N5 · Débutant', N4: 'N4 · Élémentaire', unread: 'À lire' })[value]}</button>)}</div><label className="stories-search"><Search size={17} /><span className="sr-only">Rechercher une histoire</span><input type="search" placeholder="Rechercher une histoire…" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    <div className="stories-shelf" aria-label="Histoires disponibles">{visible.map(story => <button key={story.id} id={`story-book-${story.id}`} className="story-book" onClick={event => openStory(story, event.currentTarget)} aria-label={`Lire ${story.subtitle}`}>
      <Cover story={story} />
      <span className="story-book-title">{story.subtitle}</span>
      <span className="story-book-meta">{story.level} · 1 page{progress.readIds.includes(story.id) && <span className="story-book-read"><Check size={13} />Lu</span>}</span>
      <span className="story-book-description">{story.description}</span>
    </button>)}</div>
    {!visible.length && <div className="stories-empty"><BookOpen size={30} /><h3>{filter === 'unread' && !query ? 'Toutes les histoires ont été lues !' : 'Aucune histoire trouvée'}</h3><p>Essayez un autre filtre ou une autre recherche.</p><button className="button secondary" onClick={() => { setFilter('all'); setQuery(''); }}>Voir toutes les histoires</button></div>}
    <p className="stories-footnote">Histoires originales · Définitions en français · Furigana au choix</p>
  </section>;
}
