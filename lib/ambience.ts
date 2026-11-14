export type Ambience = 'koto' | 'taiko' | 'rain';
export type AmbienceSound = { setVolume: (volume: number) => void; stop: () => void };

// Original, synthesized textures: no recordings, downloads, or third-party audio.
export async function startAmbience(kind: Ambience, volume: number, onInterrupted?: () => void): Promise<AmbienceSound> {
  const context = new AudioContext();
  try { await context.resume(); } catch (error) { void context.close(); throw error; }
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);
  const level = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 0.24;
  master.gain.setTargetAtTime(level(volume), context.currentTime, 0.25);
  const voices = new Set<AudioScheduledSourceNode>();
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const track = (source: AudioScheduledSourceNode, nodes: AudioNode[]) => {
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); };
  };
  const pluck = (frequency: number, time: number) => {
    // A damped delay-line string gives each pluck natural, fading overtones.
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const samples = buffer.getChannelData(0), period = Math.round(context.sampleRate / frequency);
    for (let i = 0; i < period; i++) samples[i] = Math.random() * 2 - 1;
    for (let i = period; i < samples.length; i++) samples[i] = 0.497 * (samples[i - period] + samples[i - period + 1]);
    const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 3200;
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.8, time + 0.006); gain.gain.exponentialRampToValueAtTime(0.001, time + 3.9);
    source.connect(filter); filter.connect(gain); gain.connect(master);
    track(source, [filter, gain]); source.start(time); source.stop(time + 4);
  };
  const drum = (time: number, soft: boolean) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.frequency.setValueAtTime(soft ? 130 : 100, time); oscillator.frequency.exponentialRampToValueAtTime(soft ? 72 : 48, time + 0.18);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(soft ? 0.22 : 0.45, time + 0.008); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.9);
    oscillator.connect(gain); gain.connect(master); track(oscillator, [gain]); oscillator.start(time); oscillator.stop(time + 1);
  };
  if (kind === 'rain') {
    const buffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.08) / 1.02; samples[i] = previous * 2.4 * Math.min(1, i / 2400, (samples.length - 1 - i) / 2400); }
    const source = context.createBufferSource(), filter = context.createBiquadFilter();
    source.buffer = buffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = 3600;
    source.connect(filter); filter.connect(master); track(source, [filter]); source.start();
  } else {
    const melody = [0, 2, 3, 7, 9, 7, 3, 2, 0, 7, 9, 12, 9, 7, 3, 2];
    let step = 0, next = context.currentTime + 0.05;
    const schedule = () => {
      if (stopped || context.state !== 'running') return;
      // Discard missed beats after a suspended/backgrounded page instead of bursting them.
      if (next < context.currentTime) next = context.currentTime + 0.05;
      while (next < context.currentTime + 0.3) {
        if (kind === 'koto') { pluck(220 * Math.pow(2, melody[step % melody.length] / 12), next); next += step % 4 === 3 ? 2.8 : 1.3; }
        else { if (step % 8 !== 7) drum(next, step % 4 !== 0); next += step % 4 === 3 ? 2.2 : 0.85; }
        step++;
      }
    };
    schedule(); timer = setInterval(schedule, 120);
  }
  const sound: AmbienceSound = {
    setVolume(value) { if (!stopped) master.gain.setTargetAtTime(level(value), context.currentTime, 0.1); },
    stop() {
      if (stopped) return;
      stopped = true; clearInterval(timer); context.onstatechange = null;
      master.gain.cancelScheduledValues(context.currentTime); master.gain.setTargetAtTime(0, context.currentTime, 0.025);
      for (const source of voices) { try { source.stop(context.currentTime + 0.1); } catch { /* Already ended. */ } }
      setTimeout(() => { master.disconnect(); void context.close().catch(() => undefined); }, 140);
    },
  };
  context.onstatechange = () => {
    if (!stopped && context.state !== 'running') { sound.stop(); onInterrupted?.(); }
  };
  return sound;
}
