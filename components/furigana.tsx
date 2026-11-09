'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildReadingIndex, hasKanji, normalizeFuriganaReading, splitFurigana, type FuriganaPart } from '@/lib/furigana';
import { japaneseReadings } from '@/lib/furigana-client';
import type { Note } from '@/lib/model';
import './furigana.css';

type FuriganaContextValue = { enabled: boolean; index: ReadonlyMap<string, string>; status: 'idle' | 'loading' | 'ready' | 'error'; error: string; revision: number; retry: () => void; resolve: (text: string, reading?: string) => Promise<FuriganaPart[]> };
const FuriganaContext = createContext<FuriganaContextValue | null>(null);
const needsAlignment = (part: FuriganaPart) => !!part.reading && Array.from(part.text).filter(hasKanji).length > 1;

export function FuriganaProvider({ enabled, notes, children }: { enabled: boolean; notes: readonly Note[]; children: ReactNode }) {
  const index = useMemo(() => buildReadingIndex(notes), [notes]);
  const [status, setStatus] = useState<FuriganaContextValue['status']>('idle');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const resolve = useCallback(async (text: string, reading?: string) => {
    setStatus(previous => previous === 'ready' ? previous : 'loading');
    try {
      const tokens = await japaneseReadings(text, reading);
      const result = (await Promise.all(tokens.map(async token => {
        const saved = index.get(token.text);
        const selected = reading || saved || token.reading;
        const matching = normalizeFuriganaReading(selected) === normalizeFuriganaReading(token.reading);
        const parts = splitFurigana(token.text, selected, matching ? token.alignment : undefined);
        return (await Promise.all(parts.map(async part => {
          if (!needsAlignment(part)) return [part];
          const aligned = await japaneseReadings(part.text, part.reading);
          return splitFurigana(part.text, part.reading, aligned[0]?.alignment);
        }))).flat();
      }))).flat();
      setStatus('ready'); setError('');
      return result;
    } catch (cause) {
      setStatus('error'); setError(cause instanceof Error ? cause.message : 'Furigana unavailable.');
      throw cause;
    }
  }, [index]);
  const retry = useCallback(() => { setError(''); setRevision(value => value + 1); }, []);
  const value = useMemo(() => ({ enabled, index, status, error, revision, retry, resolve }), [enabled, index, status, error, revision, retry, resolve]);
  return <FuriganaContext.Provider value={value}>{children}</FuriganaContext.Provider>;
}

export function useFuriganaEnabled(): boolean { return useContext(FuriganaContext)?.enabled ?? false; }

export function useFuriganaParts(text: string, reading?: string): { enabled: boolean; parts: readonly FuriganaPart[] } {
  const context = useContext(FuriganaContext);
  const enabled = context?.enabled ?? false;
  const index = context?.index;
  const resolve = context?.resolve;
  const revision = context?.revision;
  const selectedReading = normalizeFuriganaReading(reading) || index?.get(text);
  const direct = useMemo(() => {
    if (!hasKanji(text)) return [{ text }];
    const known = selectedReading;
    if (!known) return null;
    const parts = splitFurigana(text, known);
    return parts.some(part => part.reading) ? parts : null;
  }, [text, selectedReading]);
  const [resolved, setResolved] = useState<{ text: string; reading: typeof selectedReading; index: typeof index; parts: FuriganaPart[] } | null>(null);
  useEffect(() => {
    if (!enabled || (direct && !direct.some(needsAlignment)) || !resolve) return;
    let active = true;
    // Defer typing and avoid tokenizing intermediate IME input on every keystroke.
    const timer = setTimeout(() => { void resolve(text, selectedReading).then(parts => { if (active) setResolved({ text, reading: selectedReading, index, parts }); }).catch(() => {}); }, 100);
    return () => { active = false; clearTimeout(timer); };
  }, [enabled, direct, text, selectedReading, index, resolve, revision]);
  return { enabled, parts: !enabled ? [{ text }] : resolved?.text === text && resolved.reading === selectedReading && resolved.index === index ? resolved.parts : direct || [{ text }] };
}

export function JapaneseText({ text, reading }: { text: string; reading?: string }) {
  const { parts } = useFuriganaParts(text, reading);
  return <>{parts.map((part, index) => part.reading ? <ruby className="furigana-ruby" lang="ja" key={index}>{part.text}<rp>(</rp><rt>{part.reading}</rt><rp>)</rp></ruby> : part.text)}</>;
}

export function FuriganaToggle({ onChange }: { onChange: (enabled: boolean) => void }) {
  const context = useContext(FuriganaContext);
  if (!context) return null;
  return <button type="button" className={`furigana-toggle${context.status === 'loading' ? ' is-loading' : ''}${context.error ? ' has-error' : ''}`} role="switch" aria-label="Furigana" aria-checked={context.enabled} aria-busy={context.enabled && context.status === 'loading'} title={context.error || (context.enabled ? 'Hide furigana' : 'Show furigana')} onClick={() => { if (!context.enabled && context.error) context.retry(); onChange(!context.enabled); }}><span>Furigana</span><span className="furigana-switch" aria-hidden="true"><i /></span></button>;
}
