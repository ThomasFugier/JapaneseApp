'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Music2, Pause, Play, X } from 'lucide-react';
import { startAmbience, type Ambience, type AmbienceSound } from '@/lib/ambience';
import './ambience.css';

const choices: { id: Ambience; name: string; detail: string }[] = [
  { id: 'koto', name: 'Koto', detail: 'Soft plucked strings' },
  { id: 'taiko', name: 'Taiko', detail: 'A slow, gentle pulse' },
  { id: 'rain', name: 'Rain', detail: 'A quiet afternoon' },
];
const key = 'japanese-ambience-v1';
export function AmbiencePlayer({ studying, target, embedded }: { studying: boolean; target: HTMLElement | null; embedded: boolean }) {
  const panelId = useId();
  const control = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [kind, setKind] = useState<Ambience>('koto');
  const [volume, setVolume] = useState(0.35);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const sound = useRef<AmbienceSound | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const volumeRef = useRef(volume); volumeRef.current = volume;
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (choices.some(choice => choice.id === saved?.kind)) setKind(saved.kind);
      if (typeof saved?.volume === 'number' && Number.isFinite(saved.volume)) setVolume(Math.max(0, Math.min(1, saved.volume)));
    } catch { /* Optional local preferences. */ }
    return () => { mounted.current = false; generation.current++; sound.current?.stop(); sound.current = null; };
  }, []);
  useEffect(() => { if (studying) setOpen(false); }, [studying]);
  useEffect(() => { setOpen(false); }, [target]);
  useEffect(() => {
    if (!open || embedded) return;
    const dismiss = (event: PointerEvent) => { if (!control.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [open, embedded]);
  function remember(nextKind: Ambience, nextVolume: number) {
    try { localStorage.setItem(key, JSON.stringify({ kind: nextKind, volume: nextVolume })); } catch { /* Playback still works without storage. */ }
  }
  function pause() { generation.current++; sound.current?.stop(); sound.current = null; setPlaying(false); setPending(false); }
  async function play(nextKind = kind) {
    const request = ++generation.current;
    sound.current?.stop(); sound.current = null; setPlaying(false); setPending(true); setError('');
    try {
      const next = await startAmbience(nextKind, volumeRef.current, () => {
        if (mounted.current && request === generation.current) { sound.current = null; setPlaying(false); setPending(false); }
      });
      if (!mounted.current || request !== generation.current) { next.stop(); return; }
      sound.current = next; setPlaying(true);
    } catch { if (mounted.current && request === generation.current) { setError('Audio could not start. Try again.'); setOpen(true); } }
    finally { if (mounted.current && request === generation.current) setPending(false); }
  }
  if (!target) return null;
  const current = choices.find(choice => choice.id === kind)!;
  return createPortal(<aside ref={control} className={'ambience-control' + (embedded ? ' is-embedded' : '')} aria-label="Ambient audio">
    {!embedded && <button ref={trigger} className="icon-button ambience-trigger" type="button" aria-label="Ambience" title={playing ? current.name + ' playing' : 'Ambience'} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}><Music2 size={19} />{playing && <span className="ambience-playing-dot" aria-label="Playing" />}</button>}
    {(open || embedded) && <section className="ambience-panel" id={panelId} aria-label="Ambience controls">
      <div className="ambience-panel-heading"><h3><Music2 size={17} />Ambience</h3>{!embedded && <button type="button" aria-label="Close ambience" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={16} /></button>}</div>
      <div className="ambience-choices" role="group" aria-label="Soundscape">{choices.map(choice => <button key={choice.id} type="button" aria-pressed={kind === choice.id} title={choice.detail} onClick={() => { setKind(choice.id); remember(choice.id, volume); if (playing || pending) void play(choice.id); }}><span>{choice.name}</span></button>)}</div>
      <div className="ambience-transport"><button className="button secondary ambience-play" type="button" aria-label={playing || pending ? 'Pause ambience' : 'Play ambience'} aria-pressed={playing} onClick={() => playing || pending ? pause() : void play()}>{playing || pending ? <Pause size={16} /> : <Play size={16} />}<span>{pending ? 'Starting…' : playing ? 'Pause' : 'Play'}</span></button><label className="ambience-volume"><span>Volume</span><input aria-label="Ambience volume" type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={event => { const next = Number(event.target.value) / 100; volumeRef.current = next; setVolume(next); sound.current?.setVolume(next); remember(kind, next); }} /></label></div>
      {error && <p className="ambience-error" role="alert">{error}</p>}
    </section>}
  </aside>, target);
}
