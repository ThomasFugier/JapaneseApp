'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useActivitySound(enabled: boolean) {
  const context = useRef<AudioContext | null>(null);
  // Unlock on the user gesture; play only once persistence succeeds.
  const prepareSound = useCallback(() => {
    if (!enabled || typeof AudioContext === 'undefined') return;
    try {
      context.current ??= new AudioContext();
      if (context.current.state === 'suspended') void context.current.resume().catch(() => {});
    } catch { /* Optional audio must never interrupt learning. */ }
  }, [enabled]);
  const playSound = useCallback(() => {
    const audio = context.current;
    if (!enabled || !audio || audio.state !== 'running') return;
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(520, now);
      oscillator.frequency.setValueAtTime(660, now + .065);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(.025, now + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .16);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(now); oscillator.stop(now + .17);
    } catch { /* Audio failure does not affect saves. */ }
  }, [enabled]);
  useEffect(() => { if (!enabled && context.current?.state === 'running') void context.current.suspend().catch(() => {}); }, [enabled]);
  useEffect(() => () => { const audio = context.current; context.current = null; if (audio && audio.state !== 'closed') void audio.close().catch(() => {}); }, []);
  return { prepareSound, playSound };
}
