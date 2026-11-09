'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Cloud, CloudOff, Folder, Github, Home, Layers, LoaderCircle, Pencil, Plus, Search, Settings2, Trash2, Undo2, Upload, PenLine, X } from 'lucide-react';
import { useLibrary } from './use-library';
import { useWorkspaceContext, type WorkspaceTab } from './use-workspace-context';
import { LibraryView } from './library-view';
import { WritingView } from './writing-view';
import { GitHubConnection } from './github-connection';
import type { ReadingContext } from '@/lib/library-view';
import { cardsForDeck, descendants, dueCards, effectiveReviews, ratingIntervals, reviewCounts } from '@/lib/engine';
import { type Deck, type Note, type Snapshot, validateSnapshot } from '@/lib/model';
import { downloadBackup, downloadCsv, parseImport } from '@/lib/portability';
import { DeckEditor, NoteEditor, Modal } from './editors';

type Tab = WorkspaceTab;
type Session = { deckId: string | null; ids: string[]; index: number; revealed: boolean; practice: boolean; answers: { reviewId: string | null; index: number }[] };
const labels: Record<Tab, string> = { home: 'Accueil', review: 'Révision', library: 'Bibliothèque', writing: 'Écriture' };
const icons = { home: Home, review: Layers, library: BookOpen, writing: PenLine };
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
const active = <T extends { deletedAt?: string | null }>(items: T[]) => items.filter(item => !item.deletedAt);
const countNotes = (data: Snapshot, id: string | null) => new Set(cardsForDeck(data, id).map(card => card.noteId)).size;
const dateLabel = () => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

export default function Kotoba() {
  const library = useLibrary();
  const { data, ready, update, notice, setNotice, error, setError } = library;
  const { tab, setTab, reading, setReading, hydrated, captureReadingScroll, restoreReadingScroll } = useWorkspaceContext();
  const deckId = reading.deckId;
  const setDeckId = (id: string | null) => setReading({ deckId: id });
  const [editing, setEditing] = useState(false);
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
    const reset = patch.scrollY === 0 || 'search' in patch || 'sort' in patch || 'scope' in patch;
    setReading(reset ? { ...patch, scrollY: 0 } : patch);
    if (reset) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function navigate(next: Tab, id?: string | null) {
    if (session && session.index < session.ids.length && !window.confirm('Quitter cette session ? Vos réponses sont déjà sauvegardées.')) return;
    if (tab === 'library') captureReadingScroll();
    setSession(null); setEditing(false);
    if (id !== undefined) setReading({ deckId: id, search: '', scope: 'deck', expanded: null, scrollY: 0 });
    setTab(next);
    if (next === 'library' && tab === 'library') restoreReadingScroll();
    else if (next !== 'library') window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function startSession(id: string | null, practice = false) {
    const cards = practice ? cardsForDeck(data, id) : dueCards(data, id);
    if (!cards.length) { setNotice(practice ? 'Ce deck ne contient pas encore de cartes.' : 'Aucune carte à réviser dans ce deck.'); return; }
    if (tab === 'library') captureReadingScroll();
    setTab('review'); setSession({ deckId: id, ids: cards.map(card => card.id), index: 0, revealed: false, practice, answers: [] });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const currentCard = session ? data.cards.find(card => card.id === session.ids[session.index]) : undefined;
  const currentNote = currentCard ? notes.find(note => note.id === currentCard.noteId) : undefined;
  const answer = useCallback(async (rating: 1 | 2 | 3 | 4) => {
    if (!session || !session.revealed || !currentCard || answering.current) return;
    answering.current = true; setSessionBusy(true);
    try {
      const reviewId = session.practice ? null : crypto.randomUUID();
      if (reviewId) await update(snapshot => ({ ...snapshot, reviews: [...snapshot.reviews, { id: reviewId, cardId: currentCard.id, rating, reviewedAt: new Date().toISOString() }] }));
      setSession(previous => previous ? { ...previous, index: previous.index + 1, revealed: false, answers: [...previous.answers, { reviewId, index: previous.index }] } : null);
      setClock(Date.now());
    } catch { /* Storage failure is shown by useLibrary; keep current card on screen. */ }
    finally { answering.current = false; setSessionBusy(false); }
  }, [session, currentCard, update]);


  const undoLastAnswer = useCallback(async () => {
    const previous = session?.answers.at(-1);
    if (!session || !previous || answering.current) return;
    answering.current = true; setSessionBusy(true);
    try {
      if (previous.reviewId) await update(snapshot => snapshot.reviewUndos.some(undo => undo.reviewId === previous.reviewId) ? snapshot : { ...snapshot, reviewUndos: [...snapshot.reviewUndos, { id: crypto.randomUUID(), reviewId: previous.reviewId!, undoneAt: new Date().toISOString() }] });
      setSession(current => current ? { ...current, index: previous.index, revealed: true, answers: current.answers.slice(0, -1) } : null);
      setClock(Date.now()); setNotice('Dernière réponse annulée.');
    } catch { /* Preserve the current session when local storage fails. */ }
    finally { answering.current = false; setSessionBusy(false); }
  }, [session, update, setNotice]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!session || settings || noteModal || deckModal || importing || library.conflicts.length || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space' && !session.revealed) { event.preventDefault(); setSession(previous => previous ? { ...previous, revealed: true } : null); }
      if (session.revealed && /^[1-4]$/.test(event.key)) { event.preventDefault(); void answer(Number(event.key) as 1 | 2 | 3 | 4); }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [session, answer, settings, noteModal, deckModal, importing, library.conflicts.length]);

  async function removeNote(note: Note) {
    if (!window.confirm(`Supprimer « ${note.japanese} » et ses cartes ?`)) return;
    const now = new Date().toISOString();
    try { await update(snapshot => ({ ...snapshot, notes: snapshot.notes.map(item => item.id === note.id ? { ...item, deletedAt: now, updatedAt: now } : item), cards: snapshot.cards.map(card => card.noteId === note.id ? { ...card, deletedAt: now, updatedAt: now } : card) })); } catch { return; }
    setNotice('Fiche supprimée.');
  }
  async function removeDeck() {
    if (!selectedDeck || !window.confirm(`Supprimer « ${selectedDeck.name} » et ses sous-decks ? Les fiches seront conservées dans « Toutes les fiches ».`)) return;
    const ids = descendants(data, selectedDeck.id); const now = new Date().toISOString();
    try { await update(snapshot => ({ ...snapshot, decks: snapshot.decks.map(deck => ids.includes(deck.id) ? { ...deck, deletedAt: now, updatedAt: now } : deck), cards: snapshot.cards.map(card => card.deckIds.some(id => ids.includes(id)) ? { ...card, deckIds: card.deckIds.filter(id => !ids.includes(id)), updatedAt: now } : card) })); } catch { return; }
    setDeckId(null); setEditing(false); setNotice('Deck supprimé. Les fiches sont conservées.');
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
          if (previous && JSON.stringify(previous) !== JSON.stringify(review)) throw new Error('Deux historiques incompatibles partagent le même identifiant.');
          reviews.set(review.id, review);
        }
        restored.reviews = [...reviews.values()];
        const undos = new Map(old.reviewUndos.map(undo => [undo.id, undo]));
        for (const undo of restored.reviewUndos) {
          const previous = undos.get(undo.id);
          if (previous && JSON.stringify(previous) !== JSON.stringify(undo)) throw new Error('Deux annulations incompatibles partagent le même identifiant.');
          undos.set(undo.id, undo);
        }
        restored.reviewUndos = [...undos.values()];
        return validateSnapshot(restored);
      });
      setImporting(null); setSettings(false); navigate('library'); setNotice('Sauvegarde restaurée. Votre historique existant est conservé.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Restauration impossible.'); }
  }

  if (!ready || !hydrated) return <div className="loading-screen"><div className="brand-mark">言</div><p>Kotoba</p>{error ? <p role="alert" className="load-error">{error}</p> : <LoaderCircle className="spin" size={22} />}</div>;

  return <div className="app-shell">
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => navigate('home')} aria-label="Kotoba, accueil"><span className="brand-dot" />KOTOBA</button>
          <nav className="desktop-tabs" aria-label="Navigation principale">{(['home', 'review', 'library', 'writing'] as Tab[]).map(item => <button key={item} className={tab === item ? 'selected' : ''} onClick={() => navigate(item)} aria-current={tab === item ? 'page' : undefined}>{labels[item]}{item === 'review' && due.length > 0 && <span className="nav-count">{due.length}</span>}</button>)}</nav>
          <div className="topbar-actions"><button className="icon-button sync-status" onClick={() => setSettings(true)} aria-label={library.saving ? 'Enregistrement en cours' : library.syncing ? 'Synchronisation en cours' : library.error ? 'Erreur de sauvegarde' : library.status?.authenticated ? library.dirty ? 'Modifications à synchroniser' : 'Synchronisé' : 'Sauvegardé sur cet appareil'} title={library.status?.authenticated ? library.dirty ? 'À synchroniser' : 'Synchronisé' : 'Sauvegarde locale'}>{library.saving || library.syncing ? <LoaderCircle size={18} className="spin" /> : library.error ? <CloudOff size={18} /> : <Cloud size={18} />}{library.dirty && library.status?.authenticated && <span className="pending-dot" />}</button><button className="icon-button" aria-label="Rechercher dans la bibliothèque" onClick={() => { navigate('library'); setReading({ scope: 'all' }); setTimeout(() => document.getElementById('library-search')?.focus(), 50); }}><Search size={19} /></button><button className="icon-button" onClick={() => setSettings(true)} aria-label="Compte et sauvegardes"><Settings2 size={19} /></button></div>
        </div>
      </header>

      {error && <div role="alert" className="error-banner"><CloudOff size={18} /><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Fermer le message"><X size={16} /></button></div>}

      <main id="main-content" className={`main-content ${session ? 'session-main' : ''}`}>
        {tab === 'home' && <>
          <div className="page-heading"><h1>Accueil</h1><span className="page-date">{dateLabel()}</span></div>
          <section className="overview-grid" aria-label="Résumé">
            <div className="overview-review"><div className="overview-label"><Layers size={18} />Révision</div><div className="overview-number">{due.length}<span>cartes à réviser</span></div><div className="review-breakdown"><span>{counts.dueCount} dues</span><span>{counts.newCount} nouvelles</span></div><button className="button primary" disabled={!due.length} onClick={() => startSession(null)}>{due.length ? 'Commencer' : 'À jour'}<ArrowRight size={17} /></button></div>
            <div className="overview-library"><div className="overview-label"><BookOpen size={18} />Bibliothèque</div><div className="library-counts"><div><strong>{notes.length}</strong><span>fiches</span></div><div><strong>{decks.length}</strong><span>decks</span></div></div><button className="text-button" onClick={() => navigate('library')}>Ouvrir la bibliothèque<ArrowRight size={16} /></button></div>
          </section>
          <section className="home-decks"><div className="section-heading"><h2>Mes decks</h2><button className="text-button" onClick={() => navigate('library')}>Tout voir<ArrowRight size={16} /></button></div><div className="deck-grid">{homeDecks.slice(0, 3).map(deck => <DeckTile key={deck.id} deck={deck} count={countNotes(data, deck.id)} subcount={decks.filter(item => item.parentId === deck.id).length} onClick={() => navigate('library', deck.id)} />)}{decks.length === 0 && <button className="empty-deck" onClick={() => { setTab('library'); setDeckModal('new'); }}><Plus />Créer un deck</button>}</div></section>
        </>}

        {tab === 'writing' && <WritingView data={data} />}

        {tab === 'library' && <LibraryView data={data} context={reading} onContextChange={changeReading} editing={editing} onEditingChange={setEditing} onNewDeck={() => setDeckModal('new')} onEditDeck={setDeckModal} onDeleteDeck={() => void removeDeck()} onAddNote={() => setNoteModal('new')} onEditNote={setNoteModal} onDeleteNote={note => void removeNote(note)} onReview={id => startSession(id)} />}

        {tab === 'review' && !session && <><div className="page-heading"><h1>Révision</h1><span className="review-total"><Layers size={18} /><b>{due.length}</b> à réviser</span></div><button className="review-all" disabled={!due.length} onClick={() => startSession(null)}><div className="review-all-icon"><Layers size={27} /></div><div><h2>Tous mes decks</h2><p>{due.length ? <>{counts.dueCount} dues · {counts.newCount} nouvelles</> : 'Aucune carte due'}</p></div><span className="button primary">Commencer <ArrowRight size={17} /></span></button><div className="section-heading review-section"><h2>Mes decks</h2><span className="muted">Les sous-decks sont inclus</span></div><div className="review-deck-list">{decks.map(deck => { const breakdown = reviewCounts(data, deck.id, new Date(clock)); const amount = breakdown.total; return <div className="review-deck" key={deck.id}><span className={`deck-symbol ${deck.color}`}>{deckSymbol(deck)}</span><div className="review-deck-title">{deck.parentId && <span className="breadcrumb">{deckPath(data, deck).slice(0, -1).join(' / ')}</span>}<h3>{deck.name}</h3><span>{breakdown.dueCount} dues · {breakdown.newCount} nouvelles</span></div><div className="review-deck-end"><span className={`due-pill ${amount ? '' : 'done'}`}>{amount ? `${amount} à réviser` : 'À jour'}</span><button className="icon-button" aria-label={`Parcourir ${deck.name}`} title="Lecture libre" onClick={() => navigate('library', deck.id)}><BookOpen size={18} /></button><button className="icon-button" aria-label={`Réviser ${deck.name}`} onClick={() => startSession(deck.id)}><ArrowRight size={19} /></button></div></div>; })}</div>{!decks.length && <div className="empty-state"><Layers size={32} /><h3>Aucun deck</h3><button className="button primary" onClick={() => navigate('library')}>Créer un deck</button></div>}</>}

        {tab === 'review' && session && <div className="study-space"><div className="study-top"><button className="text-button" onClick={() => navigate('review')}><ArrowLeft size={16} />Quitter</button><span>{decks.find(deck => deck.id === session.deckId)?.name || 'Tous mes decks'}{session.practice && ' · entraînement libre'}</span><span>{Math.min(session.index + 1, session.ids.length)} / {session.ids.length}</span></div><div className="study-progress"><div style={{ width: `${session.index / session.ids.length * 100}%` }} /></div><div className="study-undo">{session.answers.length > 0 && <button className="text-button" disabled={sessionBusy} onClick={() => void undoLastAnswer()}><Undo2 size={15} />Annuler la dernière réponse</button>}</div>{session.index >= session.ids.length ? <div className="session-complete"><div className="complete-art"><CheckCheck size={30} /></div><h1>Session terminée</h1><p>{session.ids.length} carte{session.ids.length > 1 ? 's' : ''} parcourue{session.ids.length > 1 ? 's' : ''}.<br />{session.practice ? 'Cet entraînement n’a pas modifié votre progression.' : 'Votre progression est enregistrée sur cet appareil.'}</p><button className="button primary" onClick={() => { setSession(null); setClock(Date.now()); }}>Retour aux decks <ArrowRight size={17} /></button><button className="text-button" onClick={() => navigate('library')}>Retour à la bibliothèque</button></div> : currentNote && currentCard ? <><div className="flashcard"><div className="flashcard-label"><span className="deck-dot sage" />{currentCard.direction === 'ja-fr' ? 'JAPONAIS → FRANÇAIS' : 'FRANÇAIS → JAPONAIS'}<span>{reviewedIds.has(currentCard.id) ? 'Carte due' : 'Nouvelle carte'}</span></div><div className="flashcard-prompt"><h2 lang={currentCard.direction === 'ja-fr' ? 'ja' : 'fr'} className={currentCard.direction === 'fr-ja' ? 'french-prompt' : ''}>{currentCard.direction === 'ja-fr' ? currentNote.japanese : currentNote.meaning}</h2>{session.revealed && currentCard.direction === 'ja-fr' && <span className="prompt-reading" lang="ja">{currentNote.reading}</span>}</div>{session.revealed ? <div className="flashcard-answer"><span className="eyebrow">LA RÉPONSE</span><h3 lang={currentCard.direction === 'fr-ja' ? 'ja' : 'fr'}>{currentCard.direction === 'ja-fr' ? currentNote.meaning : currentNote.japanese}</h3>{currentCard.direction === 'fr-ja' && <p lang="ja">{currentNote.reading}</p>}{currentNote.example && <div className="answer-example"><span lang="ja">{currentNote.example}</span><p>{currentNote.exampleTranslation}</p></div>}{currentNote.explanation && <p className="answer-explanation">{currentNote.explanation}</p>}</div> : <div className="reveal-zone"><button className="button primary reveal-button" onClick={() => setSession({ ...session, revealed: true })}>Révéler la réponse <ChevronDown size={17} /></button></div>}</div>{session.revealed && <div className="rating-zone">{session.practice ? <button className="button primary" onClick={() => void answer(3)} disabled={sessionBusy}>Carte suivante <ArrowRight size={17} /></button> : <div className="rating-buttons">{([{ value: 1, label: 'À revoir', color: 'rose' }, { value: 2, label: 'Difficile', color: 'amber' }, { value: 3, label: 'Bien', color: 'sage' }, { value: 4, label: 'Facile', color: 'sky' }] as const).map(rating => <button key={rating.value} className={`rating-button ${rating.color}`} disabled={sessionBusy} onClick={() => void answer(rating.value)}><span>{rating.label}</span><small>{ratingIntervals(data, currentCard.id)[rating.value]}</small><kbd>{rating.value}</kbd></button>)}</div>}</div>}<p className="keyboard-hint">{session.revealed ? 'Touches 1 à 4 pour répondre' : 'Espace pour révéler la réponse'}</p></> : <div className="empty-state"><p>Cette fiche n’est plus disponible.</p><button className="button secondary" onClick={() => setSession({ ...session, index: session.index + 1 })}>Continuer</button></div>}</div>}
      </main>
    </div>

    <nav className="mobile-nav" aria-label="Navigation mobile">{(['home', 'review', 'library', 'writing'] as Tab[]).map(item => { const Icon = icons[item]; return <button key={item} className={tab === item ? 'selected' : ''} onClick={() => navigate(item)} aria-current={tab === item ? 'page' : undefined}><Icon size={21} /><span>{labels[item]}</span></button>; })}</nav>
    {notice && <div className="toast" role="status"><CheckCheck size={18} /><span>{notice}</span></div>}
    {noteModal && <NoteEditor data={data} note={noteModal === 'new' ? null : noteModal} defaultDeckId={deckId} onClose={() => setNoteModal(null)} onSave={async fn => { await update(fn); setNoteModal(null); setNotice('Fiche enregistrée sur cet appareil.'); }} />}
    {deckModal && <DeckEditor data={data} deck={deckModal === 'new' ? null : deckModal} defaultParentId={deckId} onClose={() => setDeckModal(null)} onSave={async fn => { await update(fn); setDeckModal(null); setNotice('Deck enregistré.'); }} />}
    {settings && <Modal title="Sauvegardes & connexion" onClose={() => setSettings(false)}><GitHubConnection connected={!!library.manualRepository} repository={library.manualRepository} onConnect={library.connectGitHub} onDisconnect={library.disconnectGitHub} />{library.status?.authenticated && <div className="settings-buttons"><button className="button primary" onClick={() => void library.sync()} disabled={library.syncing}>{library.syncing ? <LoaderCircle size={17} className="spin" /> : <Cloud size={17} />}Synchroniser</button></div>}{!library.manualRepository && library.serverStatus?.configured && <div className="server-connection">{library.serverStatus.authenticated ? <p className="muted">Connexion serveur : {library.serverStatus.user?.login}</p> : <a className="text-button" href="/api/auth/login">Connexion serveur GitHub</a>}</div>}{library.lastSyncedAt && <p className="muted small-text">Dernière synchronisation : {new Date(library.lastSyncedAt).toLocaleString('fr-FR')}</p>}<hr /><h3>Exporter mes données</h3><p className="muted">Le ZIP conserve les decks, fiches, cartes et tout l’historique de révision.</p><div className="settings-buttons"><button className="button secondary" onClick={() => { try { downloadBackup(data); setNotice('Sauvegarde ZIP téléchargée.'); } catch (cause) { setError(String(cause)); } }}><ArrowDownToLine size={17} />Sauvegarde complète</button><button className="button ghost" onClick={() => downloadCsv(data)}>Contenus CSV</button></div><hr /><h3>Restaurer une sauvegarde</h3><p className="muted">Ouvrez un export Kotoba au format ZIP ou JSON. Un aperçu sera affiché avant toute modification.</p><button className="button secondary" onClick={() => inputFile.current?.click()}><Upload size={16} />Choisir un fichier</button><input type="file" accept=".zip,.json,application/zip,application/json" ref={inputFile} hidden onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { setImporting(await parseImport(file)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Fichier illisible.'); } }} /><div className="settings-footnote"><CircleHelp size={16} /><span>Sur mobile, ajoutez Kotoba à votre écran d’accueil depuis le menu du navigateur. L’accès hors connexion est disponible après le premier chargement de la version déployée.</span></div></Modal>}
    {importing && <Modal title="Restaurer cette bibliothèque ?" onClose={() => setImporting(null)}><p>Le fichier contient <b>{active(importing.decks).length} decks</b>, <b>{active(importing.notes).length} fiches</b> et <b>{importing.reviews.length} révisions</b>.</p><p className="muted">Les contenus actuels seront remplacés. Votre historique de révision existant sera conservé. Une sauvegarde de la bibliothèque actuelle sera téléchargée avant la restauration.</p><div className="modal-actions"><button className="button secondary" onClick={() => setImporting(null)}>Annuler</button><button className="button primary" onClick={() => void restoreImport()}>Restaurer</button></div></Modal>}
    {library.conflicts.length > 0 && <Modal title="Deux versions à départager" subtitle="Aucune modification n’a été écrasée" onClose={() => setNotice('Choisissez les versions à conserver pour reprendre la synchronisation.')}><p className="muted">Une même fiche ou un même deck a été modifié sur deux appareils.</p>{library.conflicts.map(conflict => { const key = `${conflict.collection}:${conflict.id}`; const title = (conflict.local as Note)?.japanese || (conflict.local as Deck)?.name || conflict.id; return <div className="conflict-item" key={key}><h3>{title}</h3><div className="conflict-options">{(['local', 'remote'] as const).map(side => <label key={side}><input type="radio" name={key} checked={conflictChoices[key] === side} onChange={() => setConflictChoices(previous => ({ ...previous, [key]: side }))} /><strong>{side === 'local' ? 'Cet appareil' : 'GitHub'}</strong><pre>{JSON.stringify(conflict[side], null, 2)}</pre></label>)}</div></div>; })}<button className="button primary" disabled={!library.conflicts.every(conflict => conflictChoices[`${conflict.collection}:${conflict.id}`])} onClick={() => void library.resolve(conflictChoices).then(() => setConflictChoices({})).catch(cause => setError(String(cause)))}>Conserver les versions choisies</button></Modal>}
  </div>;
}

function deckPath(data: Snapshot, deck: Deck): string[] {
  const names = [deck.name]; const seen = new Set([deck.id]); let parent = deck.parentId;
  while (parent && !seen.has(parent)) { seen.add(parent); const item = data.decks.find(deck => deck.id === parent); if (!item) break; names.unshift(item.name); parent = item.parentId; }
  return names;
}
function deckSymbol(deck: Deck) { const text = normalize(deck.name); return text.includes('grammaire') ? '文' : text.includes('kanji') ? '字' : text.includes('verbe') ? '動' : text.includes('travail') ? '働' : text.includes('cuisine') ? '食' : '語'; }
function DeckTile({ deck, count, subcount, onClick }: { deck: Deck; count: number; subcount: number; onClick: () => void }) {
  return <button className={`deck-tile ${deck.color}`} onClick={onClick}><div className="deck-tile-top"><span className="tile-kanji" lang="ja">{deckSymbol(deck)}</span><ArrowRight size={19} /></div><h3>{deck.name}</h3><div className="deck-tile-footer"><span>{count} fiches</span><span>{subcount ? `${subcount} sous-decks` : ''}</span></div></button>;
}
