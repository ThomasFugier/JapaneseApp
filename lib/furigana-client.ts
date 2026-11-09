import type { FuriganaPart } from './furigana';

export type ReadingToken = { text: string; reading?: string; alignment?: FuriganaPart[] };
type Pending = { resolve: (tokens: ReadingToken[]) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
let worker: Worker | null = null;
let serial = 0;
const pending = new Map<number, Pending>();
const cached = new Map<string, ReadingToken[]>();
const running = new Map<string, Promise<ReadingToken[]>>();

function fail(error: Error) {
  worker?.terminate(); worker = null;
  for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
  pending.clear();
}

export function japaneseReadings(text: string, reading?: string): Promise<ReadingToken[]> {
  const key = `${reading || ''}\0${text}`;
  if (cached.has(key)) return Promise.resolve(cached.get(key)!);
  const existing = running.get(key);
  if (existing) return existing;
  const request = new Promise<ReadingToken[]>((resolve, reject) => {
    try {
      if (!worker) {
        worker = new Worker('/furigana/worker-v2.js', { name: 'Japanese readings' });
        worker.onmessage = event => {
          const { id, tokens, error } = event.data;
          const item = pending.get(id);
          if (!item) return;
          pending.delete(id); clearTimeout(item.timer);
          if (error) item.reject(new Error(error));
          else item.resolve(tokens);
        };
        worker.onerror = () => fail(new Error('The Japanese dictionary could not be loaded.'));
      }
      const id = ++serial;
      pending.set(id, { resolve, reject, timer: setTimeout(() => fail(new Error('The Japanese dictionary took too long to load. Try again when online.')), 120000) });
      worker.postMessage({ id, text, reading });
    } catch (error) { reject(error instanceof Error ? error : new Error('Furigana unavailable.')); }
  }).then(tokens => {
    cached.set(key, tokens);
    while (cached.size > 300 || (cached.size > 1 && [...cached.keys()].reduce((total, key) => total + key.length, 0) > 200000)) cached.delete(cached.keys().next().value!);
    return tokens;
  }).finally(() => { running.delete(key); });
  running.set(key, request);
  return request;
}
