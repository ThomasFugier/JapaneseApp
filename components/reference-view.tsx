'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { toRomaji } from 'wanakana';
import { Search, X } from 'lucide-react';
import { kanaGroups, smallKana, loanKana, searchKanji, matchesKana, gradeLabel, type KanaEntry, type KanjiEntry } from '@/lib/reference';
import { ContextualTranslation } from './contextual-translation';
import { Modal } from './editors';

type Script = 'hiragana' | 'katakana' | 'kanji';
export function ReferenceView() {
  const [translationsVisible, setTranslationsVisible] = useState(true);
  const [script, setScript] = useState<Script>('kanji');
  const [query, setQuery] = useState('');
  const [grade, setGrade] = useState('all');
  const [limit, setLimit] = useState(100);
  const [selected, setSelected] = useState<KanjiEntry | KanaEntry | null>(null);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => script === 'kanji' ? searchKanji(deferredQuery, grade) : [], [script, deferredQuery, grade]);
  const groups = useMemo(() => [...kanaGroups, { title: 'Small kana', columns: 5, entries: smallKana }, ...(script === 'katakana' ? [{ title: 'Loanword sounds', columns: 3, entries: loanKana }] : [])].map(group => ({ ...group, entries: deferredQuery.trim() ? group.entries.filter(entry => entry && matchesKana(entry, deferredQuery)) : group.entries })).filter(group => group.entries.length), [script, deferredQuery]);
  const kanji = selected && 'character' in selected ? selected : null;
  const kana = selected && 'hiragana' in selected ? selected : null;
  function switchScript(next: Script) { setScript(next); setQuery(''); setLimit(100); setSelected(null); }
  return <section className="reference-view" aria-label="Kana and kanji reference">
    {script === 'kanji' && <ContextualTranslation visible={translationsVisible} onChange={setTranslationsVisible} />}
    <header className="reference-intro"><h2>Kanji</h2><p>Explore meanings, readings and kana charts. Select a character for details.</p></header>
    <div className="reference-controls"><div className="reference-toolbar">
      <div className="reference-switch" role="group" aria-label="Writing system">{(['kanji', 'hiragana', 'katakana'] as const).map(value => <button key={value} aria-pressed={script === value} onClick={() => switchScript(value)}>{value === 'hiragana' ? 'Hiragana' : value === 'katakana' ? 'Katakana' : 'Kanji'}</button>)}</div>
      </div><div className="reference-filters"><label className="reference-search"><Search size={18} /><span className="sr-only">Search reference</span><input type="search" aria-label="Search reference" value={query} placeholder={script === 'kanji' ? 'Kanji, reading or English meaning…' : 'Kana or romaji…'} onChange={event => { setQuery(event.target.value); setLimit(100); }} />{query && <button aria-label="Clear reference search" onClick={() => { setQuery(''); setLimit(100); }}><X size={16} /></button>}</label>
      {script === 'kanji' && <label className="reference-grade"><span>School level</span><select aria-label="School level" value={grade} onChange={event => { setGrade(event.target.value); setLimit(100); }}><option value="all">All jōyō kanji</option>{[1, 2, 3, 4, 5, 6].map(value => <option key={value} value={value}>Grade {value}</option>)}<option value="secondary">Secondary school</option></select></label>}</div></div>
    <div className="reference-caption"><p>{script === 'kanji' ? 'Jōyō kanji · browse by school level or search' : 'Kana charts · grouped by sound'}</p><span>Reference only · separate from your cards</span></div>
    {script === 'kanji' ? <>
      <p className="reference-result-count" role="status">{results.length.toLocaleString('en')} kanji{results.length > limit ? ` · showing ${limit}` : ''}</p>
      <div className="kanji-reference-grid">{results.slice(0, limit).map(entry => <button key={entry.character} className="reference-character" onClick={() => setSelected(entry)} aria-label={translationsVisible ? `${entry.character} — ${entry.meanings.join(', ')}` : entry.character}><span lang="ja">{entry.character}</span>{translationsVisible && <small>{entry.meanings[0]}</small>}</button>)}</div>
      {!results.length && <p className="reference-empty">No matching jōyō kanji. Try a reading or an English meaning.</p>}
      {results.length > limit && <button className="button secondary reference-more" onClick={() => setLimit(value => value + 100)}>Load 100 more</button>}
      <p className="reference-credit">2,136 jōyō kanji · <a href="/reference/NOTICE.txt" target="_blank" rel="noreferrer">Dictionary sources & license</a></p>
    </> : <>
      <div className="kana-reference-sections">{groups.map(group => <section className="kana-reference-section" key={group.title}><h2>{group.title}<small>{group.entries.filter(Boolean).length}</small></h2><div className="kana-reference-grid" style={{ gridTemplateColumns: `repeat(${group.columns}, minmax(0, 1fr))` }}>{group.entries.map((entry, index) => entry ? <button key={entry.hiragana} className="reference-character" onClick={() => setSelected(entry)} aria-label={`${entry[script]} — ${entry.romaji}`}><span lang="ja">{entry[script]}</span><small>{entry.romaji}</small></button> : <span className="kana-gap" key={`gap-${index}`} aria-hidden="true" />)}</div></section>)}</div>
      {!groups.length && <p className="reference-empty">No matching kana. Try “shi”, “kya” or “あ”.</p>}
      <div className="reference-hint"><strong>Reading notes</strong><p>As particles, は is read “wa”, へ “e” and を “o”. Small っ / ッ doubles the next consonant. Katakana ー extends the preceding vowel.</p></div>
    </>}
    {selected && <Modal title={kanji ? 'Kanji reference' : 'Kana reference'} focusInput={false} onClose={() => setSelected(null)}>
      {kanji && <div className="reference-detail"><div className="reference-detail-symbol" lang="ja">{kanji.character}</div>{translationsVisible && <p className="reference-meanings">{kanji.meanings.join(' · ')}</p>}<p className="reference-meta">{kanji.strokes} strokes · {gradeLabel(kanji.grade)}</p><ReadingList label="On’yomi" readings={kanji.on} /><ReadingList label="Kun’yomi" readings={kanji.kun} />{kanji.kun.some(value => value.includes('.')) && <p className="reference-reading-note">The dot separates the kanji reading from its okurigana (the kana ending).</p>}</div>}
      {kana && <div className="reference-detail"><div className="reference-kana-pair"><div><span lang="ja">{kana.hiragana}</span><small>Hiragana</small></div><div><span lang="ja">{kana.katakana}</span><small>Katakana</small></div></div><p className="reference-meanings">{kana.romaji}</p>{kana.note && <p className="reference-reading-note">{kana.note}</p>}{['は', 'へ', 'を'].includes(kana.hiragana) && <p className="reference-reading-note">As a particle: {kana.hiragana === 'は' ? 'wa' : kana.hiragana === 'へ' ? 'e' : 'o'}.</p>}</div>}
    </Modal>}
  </section>;
}

function ReadingList({ label, readings }: { label: string; readings: string[] }) {
  return <section className="reference-readings"><h3>{label}</h3>{readings.length ? <ul>{readings.map(reading => <li key={reading}><span lang="ja">{reading}</span><small>{toRomaji(reading)}</small></li>)}</ul> : <p className="muted">—</p>}</section>;
}
