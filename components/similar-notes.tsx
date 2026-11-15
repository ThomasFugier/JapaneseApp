'use client';

import { useDeferredValue, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { similarNotes, type NoteDraft } from '@/lib/note-similarity';
import type { Snapshot } from '@/lib/model';
import { JapaneseText } from './furigana';
import './similar-notes.css';

export function SimilarNotes({ data, japanese, reading, meaning }: NoteDraft & { data: Snapshot }) {
  const draft = useMemo(() => ({ japanese, reading, meaning }), [japanese, reading, meaning]);
  const deferred = useDeferredValue(draft);
  const pending = deferred !== draft;
  const matches = useMemo(() => similarNotes(data, deferred), [data.notes, data.cards, deferred]);
  const decks = useMemo(() => {
    const names = new Map(data.decks.filter(deck => !deck.deletedAt).map(deck => [deck.id, deck.name]));
    const result = new Map<string, Set<string>>();
    for (const card of data.cards) {
      if (card.deletedAt) continue;
      let assigned = result.get(card.noteId);
      if (!assigned) result.set(card.noteId, assigned = new Set());
      for (const id of card.deckIds) if (names.has(id)) assigned.add(names.get(id)!);
    }
    return result;
  }, [data.decks, data.cards]);
  if (!matches.length) return null;
  return <section className="note-similar" aria-label="Similar cards" aria-busy={pending}>
    <header><Search size={15} aria-hidden="true" /><h3>Already in your library?</h3><span role="status" aria-live="polite">{pending ? 'Searching…' : `${matches.length} close match${matches.length === 1 ? '' : 'es'}`}</span></header>
    <ul>{matches.map(({ note, duplicate, sameWord }) => <li key={note.id}>
      <details className={`note-similar-match${duplicate ? ' is-duplicate' : ''}`}>
        <summary><span className="note-similar-copy"><span className="note-similar-word"><strong lang="ja"><JapaneseText text={note.japanese} reading={note.reading} /></strong>{note.reading && note.reading !== note.japanese && <small lang="ja">{note.reading}</small>}</span><span className="note-similar-meaning">{note.meaning}</span></span><span className="note-similar-kind">{duplicate ? 'Already saved' : sameWord ? 'Same word' : 'Similar'}</span><ChevronDown size={14} aria-hidden="true" /></summary>
        <div className="note-similar-detail"><p>{[...(decks.get(note.id) ?? [])].join(' · ') || 'All cards · no deck'}</p>{note.example && <p lang="ja"><JapaneseText text={note.example} /></p>}{note.exampleTranslation && <p>{note.exampleTranslation}</p>}{note.explanation && <p>{note.explanation}</p>}</div>
      </details>
    </li>)}</ul>
    <p className="note-similar-hint">Check these cards before adding another. Select a match to see its decks and details.</p>
  </section>;
}
