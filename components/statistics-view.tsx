'use client';

import { Fragment, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Pencil, Search } from 'lucide-react';
import type { Note, Snapshot } from '@/lib/model';
import { deckAncestors } from '@/lib/library-view';
import { noteSearchRank } from '@/lib/japanese-search';
import { buildStatistics, type CardStatistics, type DirectionStatistics } from '@/lib/statistics';
import { JapaneseText } from './furigana';
import './statistics-view.css';

type Filter = 'all' | 'due' | 'new' | 'weak';
type Sort = 'attention' | 'recent' | 'recall' | 'again' | 'japanese';
type Props = { data: Snapshot; now: Date; onReview: (deckId: string | null) => void; onOpenLibrary: () => void; onOpenCard: (note: Note) => void; onEditCard: (note: Note) => void };
const PAGE_SIZE = 25;
const ratingLabels = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' } as const;
const percentage = (value: number | null) => value === null ? '—' : `${Math.round(value * 100)}%`;
const fullDate = (value: string) => new Date(value).toLocaleString('en', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const shortDate = (value: string) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' });
const localDay = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
function lastSeen(value: string | null, now: Date): string {
  if (!value) return 'Never';
  const days = Math.round((localDay(now) - localDay(new Date(value))) / 86400000);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 30 ? `${days}d ago` : shortDate(value);
}
function nextReview(value: string | null, now: Date): string {
  if (!value) return 'Not scheduled';
  const minutes = Math.ceil((Date.parse(value) - now.getTime()) / 60000);
  if (minutes <= 0) return 'Due now';
  if (minutes < 60) return `in ${minutes} min`;
  if (minutes < 1440) return `in ${Math.ceil(minutes / 60)} h`;
  const days = Math.round((localDay(new Date(value)) - localDay(now)) / 86400000);
  return days === 1 ? 'Tomorrow' : days < 30 ? `in ${days}d` : shortDate(value);
}

export function StatisticsView({ data, now, onReview, onOpenLibrary, onOpenCard, onEditCard }: Props) {
  const [deckId, setDeckId] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('attention');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const timestamp = now.getTime();
  const scope = deckId && data.decks.some(deck => deck.id === deckId && !deck.deletedAt) ? deckId : null;
  const stats = useMemo(() => buildStatistics(data, new Date(timestamp), scope, period), [data, timestamp, scope, period]);
  const decks = useMemo(() => data.decks.filter(deck => !deck.deletedAt).map(deck => ({ id: deck.id, path: deckAncestors(data, deck.id).map(parent => parent.name).join(' / ') })).sort((a, b) => a.path.localeCompare(b.path, 'en')), [data]);
  const filtered = useMemo(() => {
    const collator = new Intl.Collator('ja', { numeric: true });
    return stats.cards.map(card => ({ card, rank: noteSearchRank(card.note, search) }))
      .filter(({ card, rank }) => Number.isFinite(rank) && (filter === 'all' || filter === 'due' && card.due || filter === 'new' && card.studiedDirections === 0 || filter === 'weak' && card.weak))
      .sort((a, b) => {
        if (search.trim() && a.rank !== b.rank) return a.rank - b.rank;
        const left = a.card, right = b.card;
        let order = 0;
        if (sort === 'attention') order = Number(right.weak) - Number(left.weak) || Number(right.due) - Number(left.due) || (left.recall ?? 2) - (right.recall ?? 2);
        if (sort === 'recent') order = Date.parse(right.lastReviewedAt ?? '') - Date.parse(left.lastReviewedAt ?? '') || Number(!!right.lastReviewedAt) - Number(!!left.lastReviewedAt);
        if (sort === 'recall') order = (left.recall ?? 2) - (right.recall ?? 2);
        if (sort === 'again') order = right.againCount - left.againCount || right.reviewCount - left.reviewCount;
        return order || collator.compare(left.note.reading || left.note.japanese, right.note.reading || right.note.japanese) || left.note.id.localeCompare(right.note.id);
      }).map(item => item.card);
  }, [stats.cards, search, filter, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const filterCounts = { all: stats.totalCards, due: stats.dueCards, new: stats.newCards, weak: stats.cards.filter(card => card.weak).length };
  const activity = useMemo(() => {
    const size = period > 30 ? 7 : 1;
    return Array.from({ length: Math.ceil(stats.activity.length / size) }, (_, index) => {
      const days = stats.activity.slice(index * size, (index + 1) * size);
      return { start: days[0].date, end: days[days.length - 1].date, count: days.reduce((sum, day) => sum + day.count, 0) };
    });
  }, [stats.activity, period]);
  const maximum = Math.max(1, ...activity.map(day => day.count));
  const recalled = stats.periodReviews ? (stats.periodReviews - stats.ratings[1]) / stats.periodReviews : null;
  function resetRows() { setPage(0); setExpanded(null); }

  return <section className="statistics-page" aria-label="Statistics dashboard">
    <div className="statistics-scope">
      <label><span className="sr-only">Statistics deck</span><select aria-label="Statistics deck" value={scope ?? ''} onChange={event => { setDeckId(event.target.value || null); resetRows(); }}><option value="">All cards</option>{decks.map(deck => <option key={deck.id} value={deck.id}>{deck.path}</option>)}</select></label>
      <button className="button primary" disabled={!stats.totalCards} onClick={() => onReview(scope)}>Review<ArrowRight size={15} /></button>
    </div>
    <p className="statistics-unit-note">Each card is counted once; studying either direction marks it as studied.</p>
    <div className="statistics-summary">
      <div><span title="Cards studied in at least one direction">Cards studied</span><strong>{stats.studiedCards}<small> / {stats.totalCards}</small></strong><span>{stats.newCards} unseen {stats.newCards === 1 ? 'card' : 'cards'}</span></div>
      <div><span>Estimated recall</span><strong title="Estimated chance of remembering now, based on reviewed directions. Unseen directions have no estimate.">{percentage(stats.estimatedRecall)}</strong><span>Across studied directions</span></div>
      <div><span>Cards due</span><strong>{stats.dueCards}</strong><span>With a scheduled review due</span></div>
      <div><span>Review answers · {period}d</span><strong>{stats.periodReviews}</strong><span>{stats.periodActiveDays} active {stats.periodActiveDays === 1 ? 'day' : 'days'}</span></div>
    </div>

    <div className="statistics-analytics">
      <section className="statistics-panel statistics-activity">
        <div className="statistics-panel-heading"><h2>Activity</h2><div className="statistics-period" role="group" aria-label="Statistics period">{[7, 30, 90].map(days => <button key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days}d</button>)}</div></div>
        {stats.periodReviews ? <div className="statistics-bars" role="img" aria-label={`${stats.periodReviews} answers over ${stats.periodActiveDays} active days in the last ${period} days.`}>{activity.map(day => <div key={day.start} title={`${shortDate(`${day.start}T12:00:00`)}${day.end !== day.start ? `–${shortDate(`${day.end}T12:00:00`)}` : ''}: ${day.count} answers`}><i style={{ height: `${Math.max(2, day.count / maximum * 100)}%` }} data-empty={!day.count} /></div>)}</div> : <div className="statistics-chart-empty">No reviews in this period</div>}
        <div className="statistics-chart-labels"><span>{activity.length ? shortDate(`${activity[0].start}T12:00:00`) : ''}</span><span>{period > 30 ? '7-day totals' : 'Daily totals'}</span><span>Today</span></div>
      </section>
      <section className="statistics-panel statistics-ratings">
        <div className="statistics-panel-heading"><h2>Answers</h2><span>{period} days</span></div>
        <div className="statistics-rating-bar" aria-hidden="true">{([1, 2, 3, 4] as const).map(rating => <i key={rating} data-rating={rating} style={{ flexGrow: stats.ratings[rating] }} />)}</div>
        <div className="statistics-rating-list">{([1, 2, 3, 4] as const).map(rating => <div key={rating}><span><i data-rating={rating} />{ratingLabels[rating]}</span><strong>{stats.ratings[rating]}</strong><small>{stats.periodReviews ? percentage(stats.ratings[rating] / stats.periodReviews) : '—'}</small></div>)}</div>
        <div className="statistics-recalled" title="Share of answers rated Hard, Good or Easy."><span>Recalled</span><strong>{percentage(recalled)}</strong></div>
      </section>
    </div>

    <div className="statistics-coverage" aria-label="Cards by directions studied">
      <div className="statistics-coverage-bar" aria-hidden="true"><i data-coverage="both" style={{ flexGrow: stats.bothDirectionCards }} /><i data-coverage="one" style={{ flexGrow: stats.oneDirectionCards }} /><i data-coverage="new" style={{ flexGrow: stats.newCards || (!stats.totalCards ? 1 : 0) }} /></div>
      <div><span><i data-coverage="both" />Both directions <b>{stats.bothDirectionCards} {stats.bothDirectionCards === 1 ? 'card' : 'cards'}</b></span><span><i data-coverage="one" />One direction <b>{stats.oneDirectionCards} {stats.oneDirectionCards === 1 ? 'card' : 'cards'}</b></span><span><i data-coverage="new" />Unseen <b>{stats.newCards} {stats.newCards === 1 ? 'card' : 'cards'}</b></span></div>
    </div>

    <section className="statistics-cards" aria-label="Card statistics">
      <div className="statistics-list-controls">
        <label className="search-field"><Search size={18} /><input type="search" aria-label="Search card statistics" placeholder="Word, reading or romaji…" value={search} onChange={event => { setSearch(event.target.value); resetRows(); }} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
        <select aria-label="Sort card statistics" value={sort} onChange={event => { setSort(event.target.value as Sort); resetRows(); }}><option value="attention">Needs attention</option><option value="recall">Lowest recall</option><option value="recent">Last reviewed</option><option value="again">Most Again answers</option><option value="japanese">Japanese</option></select>
      </div>
      <div className="statistics-filters" role="group" aria-label="Filter card statistics">{(['all', 'due', 'new', 'weak'] as const).map(value => <button key={value} aria-pressed={filter === value} title={value === 'weak' ? 'Low estimated recall, a recent Again answer, or relearning.' : undefined} onClick={() => { setFilter(value); resetRows(); }}>{({ all: 'All cards', due: 'Due cards', new: 'Unseen cards', weak: 'Needs work' })[value]}<span>{filterCounts[value]}</span></button>)}</div>
      <table className="statistics-table"><colgroup><col style={{ width: '34%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '16%' }} /><col style={{ width: '8%' }} /></colgroup><thead><tr><th>Card</th><th title="Japanese → English">JP → EN</th><th title="English → Japanese">EN → JP</th><th>Last reviewed</th><th>Next review</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map(card => <Fragment key={card.note.id}>
        <tr className={`statistics-note-row ${expanded === card.note.id ? 'is-expanded' : ''}`}>
          <td className="statistics-note-cell"><button className="statistics-note-toggle" aria-expanded={expanded === card.note.id} aria-controls={`statistics-${encodeURIComponent(card.note.id)}`} onClick={() => setExpanded(expanded === card.note.id ? null : card.note.id)}><span><strong lang="ja"><JapaneseText text={card.note.japanese} reading={card.note.reading} /></strong><small><JapaneseText text={card.note.meaning} /></small></span><ChevronDown size={14} /></button></td>
          <td data-label="JP → EN"><Recall value={card.directions.find(direction => direction.direction === 'ja-fr')?.recall ?? null} /></td>
          <td data-label="EN → JP"><Recall value={card.directions.find(direction => direction.direction === 'fr-ja')?.recall ?? null} /></td>
          <td data-label="Last reviewed">{card.lastReviewedAt ? <time dateTime={card.lastReviewedAt} title={fullDate(card.lastReviewedAt)}>{lastSeen(card.lastReviewedAt, now)}</time> : <span className="statistics-muted">Never</span>}</td>
          <td data-label="Next review"><span className={card.due ? 'statistics-due' : !card.nextDueAt ? 'statistics-muted' : ''} title={card.nextDueAt ? fullDate(card.nextDueAt) : undefined}>{nextReview(card.nextDueAt, now)}</span></td>
          <td className="statistics-row-actions"><button className="icon-button" aria-label={`Edit ${card.note.japanese}`} title="Edit card" onClick={() => onEditCard(card.note)}><Pencil size={15} /></button><button className="icon-button" aria-label={`Open ${card.note.japanese} in library`} title="Open in library" onClick={() => onOpenCard(card.note)}><ArrowUpRight size={16} /></button></td>
        </tr>
        {expanded === card.note.id && <tr className="statistics-detail-row" id={`statistics-${encodeURIComponent(card.note.id)}`}><td colSpan={6}><CardDetails card={card} now={now} /></td></tr>}
      </Fragment>)}</tbody></table>
      {!filtered.length && <div className="statistics-empty"><p>{stats.totalCards ? 'No matching cards' : 'No cards yet'}</p>{stats.totalCards ? <button className="text-button" onClick={() => { setSearch(''); setFilter('all'); resetRows(); }}>Clear filters</button> : <button className="button secondary" onClick={onOpenLibrary}>Open library<ArrowRight size={15} /></button>}</div>}
      <div className="statistics-pagination"><span>{filtered.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} cards` : '0 cards'}</span><div><button className="icon-button" aria-label="Previous statistics page" disabled={!currentPage} onClick={() => { setPage(currentPage - 1); setExpanded(null); }}><ChevronLeft size={17} /></button><span>{currentPage + 1} / {pageCount}</span><button className="icon-button" aria-label="Next statistics page" disabled={currentPage >= pageCount - 1} onClick={() => { setPage(currentPage + 1); setExpanded(null); }}><ChevronRight size={17} /></button></div></div>
    </section>
  </section>;
}

function Recall({ value }: { value: number | null }) {
  return <span className={`statistics-recall ${value === null ? 'is-new' : value < .8 ? 'is-weak' : ''}`} title={value === null ? 'Not studied' : 'Estimated chance of remembering now'}><span>{percentage(value)}</span>{value !== null && <i aria-hidden="true"><b style={{ width: `${value * 100}%` }} /></i>}</span>;
}

function CardDetails({ card, now }: { card: CardStatistics; now: Date }) {
  const directions = new Map(card.directions.map(direction => [direction.cardId, direction.direction]));
  return <div className="statistics-card-details"><div className="statistics-directions">{card.directions.map(direction => <DirectionDetails key={direction.cardId} direction={direction} now={now} />)}</div><div className="statistics-history"><h3>Recent answers <span>{card.reviewCount} total</span></h3>{card.history.length ? <ol>{card.history.map(review => <li key={review.id}><span className="statistics-rating-label" data-rating={review.rating}>{ratingLabels[review.rating]}</span><span>{directions.get(review.cardId) === 'ja-fr' ? 'JP → EN' : 'EN → JP'}</span><time dateTime={review.reviewedAt}>{fullDate(review.reviewedAt)}</time></li>)}</ol> : <p className="statistics-muted">No review history</p>}</div></div>;
}

function DirectionDetails({ direction, now }: { direction: DirectionStatistics; now: Date }) {
  return <section><h3>{direction.direction === 'ja-fr' ? 'Japanese → English' : 'English → Japanese'}<span>{({ new: 'Unseen', learning: 'Learning', review: 'Scheduled', relearning: 'Relearning' })[direction.state]}</span></h3><dl><div><dt>Estimated recall</dt><dd>{percentage(direction.recall)}</dd></div><div><dt>Last reviewed</dt><dd>{direction.lastReviewedAt ? <time dateTime={direction.lastReviewedAt} title={fullDate(direction.lastReviewedAt)}>{fullDate(direction.lastReviewedAt)}</time> : 'Never'}</dd></div><div><dt>Next review</dt><dd title={direction.nextDueAt ? fullDate(direction.nextDueAt) : undefined}>{nextReview(direction.nextDueAt, now)}</dd></div><div><dt>Answers</dt><dd>{direction.reviewCount}</dd></div><div><dt>Again</dt><dd>{direction.againCount}</dd></div></dl></section>;
}
