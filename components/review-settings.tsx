'use client';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { DEFAULT_REVIEW_SETTINGS, MAX_REVIEW_INTERVAL_MINUTES, reviewSettingsSchema, type ReviewSettings } from '@/lib/review-settings';
import './review-settings.css';

const units = { minutes: 1, hours: 60, days: 1440 };
const fields = [
  ['againMinutes', 'Again'], ['hardMinutes', 'Hard'], ['goodMinutes', 'Good'], ['easyMinutes', 'Easy'],
] as const;
type IntervalKey = typeof fields[number][0];
type Duration = { amount: string; unit: keyof typeof units };
type Draft = { mode: ReviewSettings['mode']; growIntervals: boolean; intervals: Record<IntervalKey, Duration> };

function duration(minutes: number): Duration {
  const unit = minutes % 1440 === 0 ? 'days' : minutes % 60 === 0 ? 'hours' : 'minutes';
  return { amount: String(minutes / units[unit]), unit };
}
function draftFor(settings: ReviewSettings): Draft {
  return { mode: settings.mode, growIntervals: settings.growIntervals, intervals: {
    againMinutes: duration(settings.againMinutes), hardMinutes: duration(settings.hardMinutes),
    goodMinutes: duration(settings.goodMinutes), easyMinutes: duration(settings.easyMinutes),
  } };
}

export function ReviewSettingsEditor({ settings, onSave }: { settings: ReviewSettings; onSave: (settings: ReviewSettings) => Promise<void> }) {
  const [draft, setDraft] = useState(() => draftFor(settings));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const baseline = useRef(JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== baseline.current;
  useEffect(() => {
    if (dirty || busy) return;
    const next = draftFor(settings);
    baseline.current = JSON.stringify(next); setDraft(next);
  }, [settings, dirty, busy]);
  function change(next: Draft) { setDraft(next); setError(''); setSaved(false); }
  function changeDuration(key: IntervalKey, patch: Partial<Duration>) {
    change({ ...draft, intervals: { ...draft.intervals, [key]: { ...draft.intervals[key], ...patch } } });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy || !dirty) return;
    const values = Object.fromEntries(fields.map(([key]) => [key, Number(draft.intervals[key].amount) * units[draft.intervals[key].unit]]));
    const parsed = reviewSettingsSchema.safeParse({ ...values, mode: draft.mode, growIntervals: draft.growIntervals, updatedAt: new Date().toISOString() });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Check the review intervals.'); return; }
    setBusy(true); setError('');
    try { await onSave(parsed.data); baseline.current = JSON.stringify(draft); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save review settings.'); }
    finally { setBusy(false); }
  }

  return <section className="review-spacing" aria-label="Review spacing">
    <h3>Review spacing</h3>
    <form className="review-spacing-form" onSubmit={submit}>
      <label className="review-spacing-mode"><span>Scheduling</span><select aria-label="Review scheduling" value={draft.mode} disabled={busy} onChange={event => change(event.target.value === 'automatic' ? { ...draftFor(settings), mode: 'automatic' } : { ...draft, mode: 'custom' })}><option value="automatic">Automatic</option><option value="custom">Custom</option></select></label>
      {draft.mode === 'automatic' ? <p className="review-spacing-help">Intervals adapt to each card.</p> : <>
        <fieldset className="review-spacing-intervals" disabled={busy}><legend className="sr-only">Review intervals</legend>{fields.map(([key, label]) => <div className="review-spacing-row" key={key}>
          <label htmlFor={`review-${key}`}>{label}</label>
          <input id={`review-${key}`} aria-label={`${label} interval`} type="number" required min="1" max={Math.floor(MAX_REVIEW_INTERVAL_MINUTES / units[draft.intervals[key].unit])} step="1" inputMode="numeric" value={draft.intervals[key].amount} onChange={event => changeDuration(key, { amount: event.target.value })} />
          <select aria-label={`${label} unit`} value={draft.intervals[key].unit} onChange={event => changeDuration(key, { unit: event.target.value as Duration['unit'] })}>{Object.keys(units).map(unit => <option value={unit} key={unit}>{unit}</option>)}</select>
        </div>)}</fieldset>
        <label className="review-spacing-growth"><input type="checkbox" checked={draft.growIntervals} disabled={busy} onChange={event => change({ ...draft, growIntervals: event.target.checked })} /><span>Increase intervals for familiar cards</span></label>
        <p className="review-spacing-help">{draft.growIntervals ? 'Repeat Good: 2× its base time. Repeat Easy: 3×. A different answer resets the multiplier. Intervals do not compound.' : 'Each answer uses the exact time above.'}</p>
      </>}
      <p className="review-spacing-help">Applies to future answers. Free practice keeps existing due dates.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="review-spacing-actions"><button type="button" className="text-button" disabled={busy} onClick={() => change(draftFor(DEFAULT_REVIEW_SETTINGS))}>Reset</button><span role="status">{saved && !dirty ? 'Saved' : ''}</span><button type="submit" className="button small primary" disabled={busy || !dirty}>{busy && <LoaderCircle size={14} className="spin" />}Save spacing</button></div>
    </form>
  </section>;
}
