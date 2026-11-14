'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Music2, Pause, Play, X } from 'lucide-react';
import { startAmbience, type Ambience, type AmbienceSound } from '@/lib/ambience';
import './ambience.css';

const choices: { id: Ambience; name: string; detail: string }[] = [
  { id: 'koto', name: 'Koto', detail: 'Soft plucked strings' },
  { id: 'taiko', name: 'Taiko', detail: 'A slow, gentle pulse' },
  { id: 'rain', name: 'Rain', detail: 'A quiet afternoon' },
];
const key = 'japanese-ambience-v1';
export function AmbiencePlayer({ studying }: { studying: boolean }) {
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
  return <aside className={`ambience-widget${open ? ' is-open' : ''}${studying ? ' in-review' : ''}`} aria-label="Ambient audio">
    {open && <div className="ambience-panel" id="ambience-panel">
      <div className="ambience-panel-heading"><span>Ambience</span><button type="button" aria-label="Close ambience" onClick={() => setOpen(false)}><X size={16} /></button></div>
      <div className="ambience-choices" role="group" aria-label="Soundscape">{choices.map(choice => <button key={choice.id} type="button" aria-pressed={kind === choice.id} onClick={() => { setKind(choice.id); remember(choice.id, volume); if (playing || pending) void play(choice.id); }}><span>{choice.name}</span><small>{choice.detail}</small></button>)}</div>
      <label className="ambience-volume"><span>Volume</span><input aria-label="Ambience volume" type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={event => { const next = Number(event.target.value) / 100; volumeRef.current = next; setVolume(next); sound.current?.setVolume(next); remember(kind, next); }} /></label>
      <p className="ambience-credit">Original synthesized soundscapes.</p>
      {error && <p className="ambience-error" role="alert">{error}</p>}
    </div>}
    <div className="ambience-bar">
      <button className="ambience-play" type="button" aria-label={playing || pending ? 'Pause ambience' : 'Play ambience'} aria-pressed={playing} onClick={() => playing || pending ? pause() : void play()}>{playing || pending ? <Pause size={15} /> : <Play size={15} />}</button>
      <button className="ambience-expand" type="button" aria-label="Choose ambience" aria-expanded={open} aria-controls="ambience-panel" onClick={() => setOpen(value => !value)}><Music2 size={14} /><span>{choices.find(choice => choice.id === kind)?.name}</span><ChevronUp size={13} /></button>
    </div>
  </aside>;
}
