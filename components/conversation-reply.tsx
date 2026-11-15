'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { annotateConversationWords } from '@/lib/conversation-word-client';
import { conversationCardDraft, type ConversationCardDraft, type ConversationWord } from '@/lib/conversation-words';
import type { ConversationMessage } from '@/lib/conversation';
import type { Snapshot } from '@/lib/model';
import { JapaneseText } from './furigana';
import './conversation-reply.css';

type Props = { message: ConversationMessage; data: Snapshot; onAnnotated: (id: string, content: string, words: ConversationWord[]) => void; onAddCard: (draft: ConversationCardDraft) => void };
const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

export const ConversationReply = memo(function ConversationReply({ message, data, onAnnotated, onAddCard }: Props) {
  const [words, setWords] = useState(message.words);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(false);
  const host = useRef<HTMLSpanElement>(null);
  const onAnnotatedRef = useRef(onAnnotated);
  onAnnotatedRef.current = onAnnotated;
  useEffect(() => {
    const node = host.current;
    if (!node || visible) return;
    const root = node.closest('.discussion-messages');
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { root, rootMargin: '100px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, message.id]);
  useEffect(() => {
    setWords(message.words);
    setFailed(false);
    if (!visible || message.words) return;
    let active = true;
    void annotateConversationWords(message.content).then((result: ConversationWord[]) => {
      if (!active) return;
      setWords(result);
      setFailed(false);
      onAnnotatedRef.current(message.id, message.content, result);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [visible, message.id, message.content, message.words, attempt]);

  const activeNotes = useMemo(() => data.notes.filter(note => !note.deletedAt), [data.notes]);
  const activeCards = useMemo(() => new Set(data.cards.filter(card => !card.deletedAt).map(card => card.noteId)), [data.cards]);
  const [selected, setSelected] = useState<ConversationWord | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 280 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const popupHeight = popup.current?.getBoundingClientRect().height ?? Math.min(280, viewportHeight - 24);
    const minTop = viewportTop + 12;
    const maxTop = viewportTop + viewportHeight - popupHeight - 12;
    const aboveTop = rect.top - popupHeight - 8;
    const belowTop = rect.bottom + 8;
    const top = aboveTop >= minTop ? aboveTop : Math.max(minTop, Math.min(belowTop, maxTop));
    const width = Math.min(320, window.innerWidth - 24);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top, maxHeight: Math.max(100, viewportHeight - 24) });
  }, []);
  const open = (word: ConversationWord, button: HTMLButtonElement) => {
    trigger.current = button;
    setSelected(word);
    const rect = button.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const width = Math.min(320, window.innerWidth - 24);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: rect.bottom + 8, maxHeight: Math.max(100, viewportHeight - 24) });
  };
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setSelected(null), 160); };
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    const onOutside = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setSelected(null);
    };
    const onScroll = (event: Event) => { if (!popup.current?.contains(event.target as Node)) setSelected(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onOutside); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place); };
  }, [selected, place]);
  useLayoutEffect(() => { if (selected) place(); }, [selected, place]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  let cursor = 0;
  const rendered = words?.map((word, index) => {
    const start = message.content.indexOf(word.text, cursor);
    if (start < cursor) return null;
    const before = message.content.slice(cursor, start);
    cursor = start + word.text.length;
    return <span key={`${index}-${start}`}>{before}{japanese.test(word.text)
      ? <button type="button" className="conversation-word" aria-label={`${word.text}, voir le sens`} aria-haspopup="dialog" onMouseEnter={event => { cancelClose(); open(word, event.currentTarget); }} onMouseLeave={scheduleClose} onFocus={event => { cancelClose(); open(word, event.currentTarget); }} onBlur={event => { if (!popup.current?.contains(event.relatedTarget as Node)) scheduleClose(); }} onClick={event => open(word, event.currentTarget)}><JapaneseText text={word.text} reading={word.reading} /></button>
      : word.text}</span>;
  });
  const duplicate = selected ? activeNotes.some(note => (note.japanese === selected.lemma || note.japanese === selected.text) && activeCards.has(note.id)) : false;
  const savedNote = selected && activeNotes.find(note => (note.japanese === selected.lemma || note.japanese === selected.text) && activeCards.has(note.id));

  return <>
    <span ref={host}>{words ? <>{rendered}{message.content.slice(cursor)}</> : <><JapaneseText text={message.content} />{failed && <button type="button" className="conversation-annotation-retry" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Réessayer l’analyse des mots</button>}</>}</span>
    {selected && typeof document !== 'undefined' && createPortal(<div ref={popup} role="dialog" aria-label={`Sens de ${selected.text}`} className="conversation-word-popup" style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }} onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
      <div className="conversation-word-heading"><strong lang="ja"><JapaneseText text={selected.lemma || selected.text} /></strong><span lang="ja">{selected.dictionaryReading || selected.reading}</span>{selected.text !== selected.lemma && <span>Dans la phrase : <JapaneseText text={selected.text} reading={selected.reading} /></span>}</div>
      {selected.partOfSpeech && <small className="conversation-word-pos">{selected.partOfSpeech}</small>}
      {selected.definitions.length ? <><small className="conversation-word-language">{selected.language === 'fr' ? 'FR' : 'EN'}</small><ol>{selected.definitions.map((definition, index) => <li key={index}>{definition}</li>)}</ol></> : <p className="conversation-word-unavailable">Traduction indisponible</p>}
      {selected.source === 'JMdict' && <a className="conversation-word-source" href="/conversation-dictionary/NOTICE.txt" target="_blank" rel="noreferrer">Sens de dictionnaire · {selected.language === 'fr' ? 'FR' : 'EN'}</a>}
      {duplicate ? <p className="conversation-word-duplicate">Déjà dans tes cartes{savedNote?.meaning ? ` · ${savedNote.meaning}` : ''}</p> : <button type="button" className="conversation-word-add" onClick={() => { onAddCard(conversationCardDraft(selected, message.content)); setSelected(null); }}>Ajouter une carte</button>}
    </div>, document.body)}
  </>;
});
