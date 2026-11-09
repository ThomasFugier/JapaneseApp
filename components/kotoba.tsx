'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Cloud, CloudOff, Folder, Github, Home, Layers, LoaderCircle, Pencil, Plus, Search, Settings2, Trash2, Undo2, Upload, PenLine, X } from 'lucide-react';
import { useLibrary } from './use-library';
import { useWorkspaceContext, type WorkspaceTab } from './use-workspace-context';
import { LibraryView } from './library-view';
import { WorkspaceSearch } from './workspace-search';
import { WritingView } from './writing-view';
import { FuriganaProvider, FuriganaToggle, JapaneseText } from './furigana';
import { JapaneseFontToggle } from './japanese-font-toggle';
import { GitHubConnection } from './github-connection';
import { BackupIndicator, BackupSummary } from './backup-status';
import type { BackupState } from '@/lib/backup-status';
import type { ReadingContext } from '@/lib/library-view';
import { cardsForDeck, descendants, dueCards, effectiveReviews, ratingIntervals, reviewCounts } from '@/lib/engine';
import { type Deck, type Note, type Snapshot, validateSnapshot } from '@/lib/model';
import { advanceReviewSession, createReviewSession, rewindReviewSession, type ReviewSession as Session } from '@/lib/review-session';
import { downloadBackup, downloadCsv, parseImport } from '@/lib/portability';
import { DeckEditor, NoteEditor, Modal } from './editors';

type Tab = WorkspaceTab;
const labels: Record<Tab, string> = { home: 'Home', review: 'Review', library: 'Library', writing: 'Writing' };
const icons = { home: Home, review: Layers, library: BookOpen, writing: PenLine };
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
const active = <T extends { deletedAt?: string | null }>(items: T[]) => items.filter(item => !item.deletedAt);
const countNotes = (data: Snapshot, id: string | null) => new Set(cardsForDeck(data, id).map(card => card.noteId)).size;

export default function Kotoba() {
  const library = useLibrary();
  const { data, ready, update, notice, setNotice, error, setError } = library;
  const { tab, setTab, reading, setReading, japaneseFont, setJapaneseFont, furiganaEnabled, setFuriganaEnabled, hydrated, captureReadingScroll, restoreReadingScroll } = useWorkspaceContext();
  const deckId = reading.deckId;
  const setDeckId = (id: string | null) => setReading({ deckId: id });
  const [editing, setEditing] = useState(false);
  const [searchActions, setSearchActions] = useState<HTMLDivElement | null>(null);
  const [noteModal, setNoteModal] = useState<Note | 'new' | null>(null);
  const [deckModal, setDeckModal] = useState<Deck | 'new' | null>(null);
  const [settings, setSettings] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [importing, setImporting] = useState<Snapshot | null>(null);
  const [conflictChoices, setConflictChoices] = useState<Record<string, 'local' | 'remote'>>({});
  const inputFile = useRef<HTMLInputElement>(null);
  const answering = useRef(false);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice, setNotice]);
  const decks = active(data.decks);
  const notes = active(data.notes);
  const roots = decks.filter(deck => !deck.parentId || !decks.some(parent => parent.id === deck.parentId));
  const homeDecks = roots.length === 1 && decks.some(deck => deck.parentId === roots[0].id) ? decks.filter(deck => deck.parentId === roots[0].id) : roots;
  const selectedDeck = decks.find(deck => deck.id === deckId);
  const allCards = useMemo(() => cardsForDeck(data, null), [data]);
  const due = useMemo(() => dueCards(data, null, new Date(clock)), [data, clock]);
  const counts = useMemo(() => reviewCounts(data, null, new Date(clock)), [data, clock]);
  const reviewedIds = useMemo(() => new Set(effectiveReviews(data).map(review => review.cardId)), [data]);

  useLayoutEffect(() => {
    if (!ready || !hydrated || tab !== 'library') return;
    const frame = restoreReadingScroll();
    return () => cancelAnimationFrame(frame);
  }, [ready, hydrated, tab, restoreReadingScroll]);

  useEffect(() => {
    if (ready && deckId && !data.decks.some(deck => deck.id === deckId && !deck.deletedAt)) setReading({ deckId: null, expanded: null, scrollY: 0 });
  }, [ready, data.decks, deckId, setReading]);

  function changeReading(patch: Partial<ReadingContext>) {
    const reset = patch.scrollY === 0 || 'search' in patch || 'sort' in patch;
    setReading(reset ? { ...patch, scrollY: 0 } : patch);
    if (reset) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function searchLibrary(value: string) {
    if (tab === 'home') {
      if (!value) return;
      setReading({ deckId: null, search: value, expanded: null, scrollY: 0 });
      setEditing(false);
      setTab('library');
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else changeReading({ search: value, expanded: null });
  }
  function navigate(next: Tab, id?: string | null) {
    if (tab === 'library') captureReadingScroll();
    setSession(null); setEditing(false);
    if (id !== undefined) setReading({ deckId: id, search: '', expanded: null, scrollY: 0 });
    setTab(next);
    if (next === 'library' && tab === 'library') restoreReadingScroll();
    else if (next !== 'library') window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function startSession(id: string | null, practice = false) {
    const next = createReviewSession(data, id, practice);
    if (!next) { setNotice('This deck has no cards yet.'); return; }
    if (tab === 'library') captureReadingScroll();
    setTab('review'); setSession(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const currentCard = session ? data.cards.find(card => card.id === session.ids[session.index]) : undefined;
  const currentNote = currentCard ? notes.find(note => note.id === currentCard.noteId) : undefined;
  const answer = useCallback(async (rating: 1 | 2 | 3 | 4) => {
    if (!session || !session.revealed || !currentCard || answering.current) return;
    answering.current = true; setSessionBusy(true);
    try {
      const reviewId = session.practice ? null : crypto.randomUUID();
      let reviewed = data;
      if (reviewId) await update(snapshot => {
        reviewed = { ...snapshot, reviews: [...snapshot.reviews, { id: reviewId, cardId: currentCard.id, rating, reviewedAt: new Date().toISOString() }] };
        return reviewed;
      });
      const now = new Date();
      setSession(previous => previous === session ? advanceReviewSession(previous, reviewed, reviewId, now) : previous);
      setClock(Date.now());
    } catch { /* Storage failure is shown by useLibrary; keep current card on screen. */ }
    finally { answering.current = false; setSessionBusy(false); }
  }, [session, currentCard, data, update]);


  const undoLastAnswer = useCallback(async () => {
    const previous = session?.answers.at(-1);
    if (!session || !previous || answering.current) return;
    answering.current = true; setSessionBusy(true);
    try {
      if (previous.reviewId) await update(snapshot => snapshot.reviewUndos.some(undo => undo.reviewId === previous.reviewId) ? snapshot : { ...snapshot, reviewUndos: [...snapshot.reviewUndos, { id: crypto.randomUUID(), reviewId: previous.reviewId!, undoneAt: new Date().toISOString() }] });
      setSession(current => current === session ? rewindReviewSession(current) : current);
      setClock(Date.now()); setNotice('Last answer undone.');
    } catch { /* Preserve the current session when local storage fails. */ }
    finally { answering.current = false; setSessionBusy(false); }
  }, [session, update, setNotice]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!session || settings || noteModal || deckModal || importing || library.conflicts.length || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.target instanceof HTMLElement && event.target.isContentEditable) return;
      if (event.key.toLowerCase() === 'e' && !event.ctrlKey && !event.metaKey && !event.altKey && currentNote && !sessionBusy) { event.preventDefault(); setNoteModal(currentNote); return; }
      if (event.target instanceof HTMLButtonElement) return;
      if (event.code === 'Space' && session.revealed && session.practice) { event.preventDefault(); void answer(3); return; }
      if (event.code === 'Space' && !session.revealed) { event.preventDefault(); setSession(previous => previous ? { ...previous, revealed: true } : null); }
      if (!session.practice && session.revealed && /^[1-4]$/.test(event.key)) { event.preventDefault(); void answer(Number(event.key) as 1 | 2 | 3 | 4); }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [session, answer, currentNote, sessionBusy, settings, noteModal, deckModal, importing, library.conflicts.length]);

  async function removeNote(note: Note) {
    if (!window.confirm(`Delete “${note.japanese}” and its cards?`)) return;
    const now = new Date().toISOString();
    try { await update(snapshot => ({ ...snapshot, notes: snapshot.notes.map(item => item.id === note.id ? { ...item, deletedAt: now, updatedAt: now } : item), cards: snapshot.cards.map(card => card.noteId === note.id ? { ...card, deletedAt: now, updatedAt: now } : card) })); } catch { return; }
    setNotice('Note deleted.');
  }
  async function removeDeck() {
    if (!selectedDeck || !window.confirm(`Delete “${selectedDeck.name}” and its subdecks? Notes will remain in “All cards”.`)) return;
    const ids = descendants(data, selectedDeck.id); const now = new Date().toISOString();
    try { await update(snapshot => ({ ...snapshot, decks: snapshot.decks.map(deck => ids.includes(deck.id) ? { ...deck, deletedAt: now, updatedAt: now } : deck), cards: snapshot.cards.map(card => card.deckIds.some(id => ids.includes(id)) ? { ...card, deckIds: card.deckIds.filter(id => !ids.includes(id)), updatedAt: now } : card) })); } catch { return; }
    setDeckId(null); setEditing(false); setNotice('Deck deleted. Notes have been kept.');
  }

  async function restoreImport() {
    if (!importing) return;
    try {
      downloadBackup(data);
      const now = new Date().toISOString();
      await update(old => {
        const restored = structuredClone(importing);
        for (const key of ['decks', 'notes', 'cards'] as const) {
          const ids = new Set(restored[key].map(item => item.id));
          for (const item of old[key]) if (!ids.has(item.id)) (restored[key] as Array<typeof item>).push({ ...item, deletedAt: now, updatedAt: now });
        }
        // Review events are immutable; preserve existing events for safe cross-device restores.
        const reviews = new Map(old.reviews.map(review => [review.id, review]));
        for (const review of restored.reviews) {
          const previous = reviews.get(review.id);
          if (previous && JSON.stringify(previous) !== JSON.stringify(review)) throw new Error('Two incompatible review histories share the same ID.');
          reviews.set(review.id, review);
        }
        restored.reviews = [...reviews.values()];
        const undos = new Map(old.reviewUndos.map(undo => [undo.id, undo]));
        for (const undo of restored.reviewUndos) {
          const previous = undos.get(undo.id);
          if (previous && JSON.stringify(previous) !== JSON.stringify(undo)) throw new Error('Two incompatible undo events share the same ID.');
          undos.set(undo.id, undo);
        }
        restored.reviewUndos = [...undos.values()];
        return validateSnapshot(restored);
      });
      setImporting(null); setSettings(false); navigate('library'); setNotice('Backup restored. Your existing history has been kept.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to restore backup.'); }
  }

  if (!ready || !hydrated) return <div className="loading-screen"><div className="brand-mark"><span className="brand-dot" /></div><p>Japanese</p>{error ? <p role="alert" className="load-error">{error}</p> : <LoaderCircle className="spin" size={22} />}</div>;

  const backupState: BackupState = { saving: library.saving, syncing: library.syncing, localSaveError: library.localSaveError, syncError: library.syncError, connected: !!library.status?.authenticated, dirty: library.dirty, lastSyncedAt: library.lastSyncedAt, conflicts: library.conflicts.length };

  return <FuriganaProvider enabled={furiganaEnabled} notes={data.notes}><div className={`app-shell ${furiganaEnabled ? 'has-furigana' : ''} ${session && session.index < session.ids.length ? 'is-studying' : ''} has-display-tools ${japaneseFont === 'plain' ? 'plain-japanese' : ''}`}>
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => navigate('home')} aria-label="Japanese, home"><span className="brand-dot" />Japanese</button>
          <nav className="desktop-tabs" aria-label="Main navigation">{(['home', 'review', 'library', 'writing'] as Tab[]).map(item => <button key={item} className={tab === item ? 'selected' : ''} onClick={() => navigate(item)} aria-current={tab === item ? 'page' : undefined}>{labels[item]}{item === 'review' && <span className={`nav-count${due.length ? '' : ' is-empty'}`} aria-hidden={!due.length}>{due.length || ''}</span>}</button>)}</nav>
          <div className="topbar-actions"><BackupIndicator state={backupState} onOpen={() => setSettings(true)} /><button className="icon-button" aria-label="Search the library" onClick={() => { navigate('library'); setReading({ deckId: null, expanded: null, scrollY: 0 }); setTimeout(() => document.getElementById('library-search')?.focus(), 50); }}><Search size={19} /></button><button className="icon-button" onClick={() => setSettings(true)} aria-label="Account and backups"><Settings2 size={19} /></button></div>
        </div>
      </header>

      {error && <div role="alert" className="error-banner"><CloudOff size={18} /><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Dismiss message"><X size={16} /></button></div>}

      <main id="main-content" className={`main-content ${session ? 'session-main' : ''}`} aria-label={labels[tab]}>
        {!session && <h1 className="sr-only">{labels[tab]}</h1>}
        {(tab === 'home' || tab === 'library') && <WorkspaceSearch home={tab === 'home'} value={tab === 'home' ? '' : reading.search} sort={reading.sort} onChange={searchLibrary} onSortChange={sort => changeReading({ sort })} actionsRef={setSearchActions} />}
        <div key={tab} className="workspace-view">
        {tab === 'home' && <>
          {!notes.length && !library.status?.authenticated && <section className="home-cloud-connection"><GitHubConnection status={library.status} onDisconnect={library.disconnectGitHub} /></section>}
          <section className="overview-grid" aria-label="Overview">
            <div className="overview-review"><div className="overview-label"><Layers size={18} />Review</div><div className="overview-number">{due.length}<span>review{due.length !== 1 ? 's' : ''} due</span></div><div className="review-breakdown"><span>{counts.dueCount} due</span><span>{counts.newCount} new</span></div><button className="button primary" disabled={!allCards.length} onClick={() => startSession(null)}>Start<ArrowRight size={17} /></button></div>
            <div className="overview-library"><div className="overview-label"><BookOpen size={18} />Library</div><div className="library-counts"><div><strong>{notes.length}</strong><span>note{notes.length !== 1 ? 's' : ''}</span></div><div><strong>{decks.length}</strong><span>deck{decks.length !== 1 ? 's' : ''}</span></div></div><button className="text-button" onClick={() => navigate('library')}>Open library<ArrowRight size={16} /></button></div>
          </section>
          <section className="home-decks"><div className="section-heading"><h2>My decks</h2><button className="text-button" onClick={() => navigate('library')}>View all<ArrowRight size={16} /></button></div><div className="deck-grid">{homeDecks.slice(0, 3).map(deck => <DeckTile key={deck.id} deck={deck} count={countNotes(data, deck.id)} subcount={decks.filter(item => item.parentId === deck.id).length} onClick={() => navigate('library', deck.id)} />)}{decks.length === 0 && <button className="empty-deck" onClick={() => { setTab('library'); setDeckModal('new'); }}><Plus />Create a deck</button>}</div></section>
        </>}

        {tab === 'writing' && <WritingView data={data} japaneseFont={japaneseFont} />}

        {tab === 'library' && <LibraryView data={data} searchActions={searchActions} context={reading} onContextChange={changeReading} editing={editing} onEditingChange={setEditing} onNewDeck={() => setDeckModal('new')} onEditDeck={setDeckModal} onDeleteDeck={() => void removeDeck()} onAddNote={() => setNoteModal('new')} onEditNote={setNoteModal} onDeleteNote={note => void removeNote(note)} onReview={id => startSession(id)} />}

        {tab === 'review' && !session && <><button className="review-all" disabled={!allCards.length} onClick={() => startSession(null)}><div className="review-all-icon"><Layers size={27} /></div><div><h2>All my decks</h2><p>{due.length ? <>{counts.dueCount} due · {counts.newCount} new</> : 'Free practice'}</p></div><span className="button primary">Start <ArrowRight size={17} /></span></button><div className="section-heading review-section"><h2>My decks</h2><span className="muted">Subdecks are included</span></div><div className="review-deck-list">{decks.map(deck => { const breakdown = reviewCounts(data, deck.id, new Date(clock)); const amount = breakdown.total; return <div className="review-deck" key={deck.id}><span className={`deck-symbol ${deck.color}`}><DeckSymbol deck={deck} /></span><div className="review-deck-title">{deck.parentId && <span className="breadcrumb"><JapaneseText text={deckPath(data, deck).slice(0, -1).join(' / ')} /></span>}<h3><JapaneseText text={deck.name} /></h3><span>{breakdown.dueCount} due · {breakdown.newCount} new</span></div><div className="review-deck-end"><span className={`due-pill ${amount ? '' : 'done'}`}>{amount ? `${amount} to review` : 'Up to date'}</span><button className="icon-button" aria-label={`Browse ${deck.name}`} title="Browse freely" onClick={() => navigate('library', deck.id)}><BookOpen size={18} /></button><button className="icon-button" aria-label={`Review ${deck.name}`} onClick={() => startSession(deck.id)}><ArrowRight size={19} /></button></div></div>; })}</div>{!decks.length && <div className="empty-state"><Layers size={32} /><h3>No decks</h3><button className="button primary" onClick={() => navigate('library')}>Create a deck</button></div>}</>}

        {tab === 'review' && session && <div className="study-space"><div className="study-top"><button className="text-button" onClick={() => navigate('review')}><ArrowLeft size={16} />Leave</button><span className="study-context"><span><JapaneseText text={decks.find(deck => deck.id === session.deckId)?.name || 'All my decks'} /></span>{session.practice && <small>Free practice</small>}</span><div className="study-controls"><span>{session.index} reviewed</span>{currentNote && <button type="button" className="icon-button study-edit" title="Edit current card (E)" aria-label="Edit current card" disabled={sessionBusy} onClick={() => setNoteModal(currentNote)}><Pencil size={17} /></button>}</div></div><div className="study-undo">{session.answers.length > 0 && <button className="text-button" disabled={sessionBusy} onClick={() => void undoLastAnswer()}><Undo2 size={15} />Undo last answer</button>}</div>{session.index >= session.ids.length ? <div className="session-complete"><div className="complete-art"><Layers size={30} /></div><h1>No cards available</h1><p>This deck has no cards.</p><button className="button primary" onClick={() => navigate('review')}>Back to decks <ArrowRight size={17} /></button></div> : currentNote && currentCard ? <><div className="flashcard" key={`${currentCard.id}:${session.index}`}><div className="flashcard-label"><span className="deck-dot sage" />{currentCard.direction === 'ja-fr' ? 'Japanese → Meaning' : 'Meaning → Japanese'}{!session.practice && <span>{reviewedIds.has(currentCard.id) ? 'Due' : 'New'}</span>}</div><div className="flashcard-prompt"><h2 lang={currentCard.direction === 'ja-fr' ? 'ja' : undefined} className={currentCard.direction === 'fr-ja' ? 'french-prompt' : ''}>{currentCard.direction === 'ja-fr' ? <JapaneseText text={currentNote.japanese} reading={currentNote.reading} /> : <JapaneseText text={currentNote.meaning} />}</h2>{session.revealed && currentCard.direction === 'ja-fr' && <span className="prompt-reading" lang="ja">{currentNote.reading}</span>}</div>{session.revealed ? <div className="flashcard-answer"><span className="eyebrow">THE ANSWER</span><h3 lang={currentCard.direction === 'fr-ja' ? 'ja' : undefined}>{currentCard.direction === 'ja-fr' ? <JapaneseText text={currentNote.meaning} /> : <JapaneseText text={currentNote.japanese} reading={currentNote.reading} />}</h3>{currentCard.direction === 'fr-ja' && <p lang="ja">{currentNote.reading}</p>}{currentNote.example && <div className="answer-example"><span lang="ja"><JapaneseText text={currentNote.example} /></span><p><JapaneseText text={currentNote.exampleTranslation} /></p></div>}{currentNote.explanation && <p className="answer-explanation"><JapaneseText text={currentNote.explanation} /></p>}</div> : <div className="reveal-zone"><button className="button primary reveal-button" onClick={() => setSession({ ...session, revealed: true })}>Reveal answer <ChevronDown size={17} /></button></div>}</div>{session.revealed && <div className="rating-zone">{session.practice ? <button className="button primary" onClick={() => void answer(3)} disabled={sessionBusy}>Next card <ArrowRight size={17} /></button> : <div className="rating-buttons">{([{ value: 1, label: 'Again', color: 'rose' }, { value: 2, label: 'Hard', color: 'amber' }, { value: 3, label: 'Good', color: 'sage' }, { value: 4, label: 'Easy', color: 'sky' }] as const).map(rating => <button key={rating.value} className={`rating-button ${rating.color}`} disabled={sessionBusy} onClick={() => void answer(rating.value)}><span>{rating.label}</span><small>{ratingIntervals(data, currentCard.id)[rating.value]}</small><kbd>{rating.value}</kbd></button>)}</div>}</div>}<p className="keyboard-hint">{session.revealed ? session.practice ? 'Space to continue · E to edit' : '1–4 to answer · E to edit' : 'Space to reveal · E to edit'}</p></> : <div className="empty-state"><p>This note is no longer available.</p><button className="button secondary" onClick={() => setSession({ ...session, index: session.index + 1 })}>Continue</button></div>}</div>}
        </div>
      </main>
    </div>

    <aside className="display-toolbar" aria-label="Display tools"><JapaneseFontToggle value={japaneseFont} onChange={setJapaneseFont} /><FuriganaToggle onChange={setFuriganaEnabled} /></aside>
    <nav className="mobile-nav" aria-label="Mobile navigation">{(['home', 'review', 'library', 'writing'] as Tab[]).map(item => { const Icon = icons[item]; return <button key={item} className={tab === item ? 'selected' : ''} onClick={() => navigate(item)} aria-current={tab === item ? 'page' : undefined}><Icon size={21} /><span>{labels[item]}</span></button>; })}</nav>
    {notice && <div className="toast" role="status"><CheckCheck size={18} /><span>{notice}</span></div>}
    {noteModal && <NoteEditor data={data} contentOnly={!!session} note={noteModal === 'new' ? null : noteModal} defaultDeckId={deckId} onClose={() => setNoteModal(null)} onSave={async fn => { await update(fn); setNoteModal(null); setNotice(session ? '' : 'Note saved on this device.'); }} />}
    {deckModal && <DeckEditor data={data} deck={deckModal === 'new' ? null : deckModal} defaultParentId={deckId} onClose={() => setDeckModal(null)} onSave={async fn => { await update(fn); setDeckModal(null); setNotice('Deck saved.'); }} />}
    {settings && <Modal title="Backups & connection" onClose={() => setSettings(false)}><BackupSummary state={backupState} /><GitHubConnection status={library.status} onDisconnect={library.disconnectGitHub} />{library.status?.authenticated && <div className="settings-buttons"><button className="button primary" onClick={() => void library.sync()} disabled={library.syncing}>{library.syncing ? <LoaderCircle size={17} className="spin" /> : <Cloud size={17} />}Sync</button></div>}<hr /><h3>Export my data</h3><p className="muted">The ZIP preserves decks, notes, cards, and the full review history.</p><div className="settings-buttons"><button className="button secondary" onClick={() => { try { downloadBackup(data); setNotice('ZIP backup downloaded.'); } catch (cause) { setError(String(cause)); } }}><ArrowDownToLine size={17} />Full backup</button><button className="button ghost" onClick={() => downloadCsv(data)}>CSV content</button></div><hr /><h3>Restore a backup</h3><p className="muted">Open a Japanese export in ZIP or JSON format. A preview will appear before any changes.</p><button className="button secondary" onClick={() => inputFile.current?.click()}><Upload size={16} />Choose a file</button><input type="file" accept=".zip,.json,application/zip,application/json" ref={inputFile} hidden onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { setImporting(await parseImport(file)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to read file.'); } }} /><div className="settings-footnote"><CircleHelp size={16} /><span>On mobile, add Japanese to your home screen from the browser menu. Offline access is available after the first load of the deployed version.</span></div><p className="dictionary-credits"><a href="/furigana/NOTICE.txt" target="_blank" rel="noreferrer">Dictionary credits</a></p></Modal>}
    {importing && <Modal title="Restore this library?" onClose={() => setImporting(null)}><p>The file contains <b>{active(importing.decks).length} deck{active(importing.decks).length !== 1 ? 's' : ''}</b>, <b>{active(importing.notes).length} note{active(importing.notes).length !== 1 ? 's' : ''}</b> and <b>{importing.reviews.length} review{importing.reviews.length !== 1 ? 's' : ''}</b>.</p><p className="muted">Current content will be replaced. Your existing review history will be kept. A backup of the current library will be downloaded before restoration.</p><div className="modal-actions"><button className="button secondary" onClick={() => setImporting(null)}>Cancel</button><button className="button primary" onClick={() => void restoreImport()}>Restore</button></div></Modal>}
    {library.conflicts.length > 0 && <Modal title="Choose between two versions" subtitle="No changes have been overwritten" onClose={() => setNotice('Choose which versions to keep to resume syncing.')}><p className="muted">The same note or deck was edited on two devices.</p>{library.conflicts.map(conflict => { const key = `${conflict.collection}:${conflict.id}`; const title = (conflict.local as Note)?.japanese || (conflict.local as Deck)?.name || conflict.id; return <div className="conflict-item" key={key}><h3><JapaneseText text={title} /></h3><div className="conflict-options">{(['local', 'remote'] as const).map(side => <label key={side}><input type="radio" name={key} checked={conflictChoices[key] === side} onChange={() => setConflictChoices(previous => ({ ...previous, [key]: side }))} /><strong>{side === 'local' ? 'This device' : 'GitHub'}</strong><pre>{JSON.stringify(conflict[side], null, 2)}</pre></label>)}</div></div>; })}<button className="button primary" disabled={!library.conflicts.every(conflict => conflictChoices[`${conflict.collection}:${conflict.id}`])} onClick={() => void library.resolve(conflictChoices).then(() => setConflictChoices({})).catch(cause => setError(String(cause)))}>Keep selected versions</button></Modal>}
  </div></FuriganaProvider>;
}

function deckPath(data: Snapshot, deck: Deck): string[] {
  const names = [deck.name]; const seen = new Set([deck.id]); let parent = deck.parentId;
  while (parent && !seen.has(parent)) { seen.add(parent); const item = data.decks.find(deck => deck.id === parent); if (!item) break; names.unshift(item.name); parent = item.parentId; }
  return names;
}
function deckSymbol(deck: Deck) { const text = normalize(deck.name); return (text.includes('grammaire') || text.includes('grammar')) ? '文' : text.includes('kanji') ? '字' : text.includes('verb') ? '動' : (text.includes('travail') || text.includes('work')) ? '働' : (text.includes('cuisine') || text.includes('cook') || text.includes('food')) ? '食' : '語'; }
function DeckSymbol({ deck }: { deck: Deck }) {
  const symbol = deckSymbol(deck);
  const readings: Record<string, string> = { 文: 'ぶん', 字: 'じ', 動: 'どう', 働: 'どう', 食: 'しょく', 語: 'ご' };
  return <JapaneseText text={symbol} reading={readings[symbol]} />;
}
function DeckTile({ deck, count, subcount, onClick }: { deck: Deck; count: number; subcount: number; onClick: () => void }) {
  return <button className={`deck-tile ${deck.color}`} onClick={onClick}><div className="deck-tile-top"><span className="tile-kanji" lang="ja"><DeckSymbol deck={deck} /></span><ArrowRight size={19} /></div><h3><JapaneseText text={deck.name} /></h3><div className="deck-tile-footer"><span>{count} note{count !== 1 ? 's' : ''}</span><span>{subcount ? `${subcount} subdeck${subcount !== 1 ? 's' : ''}` : ''}</span></div></button>;
}
