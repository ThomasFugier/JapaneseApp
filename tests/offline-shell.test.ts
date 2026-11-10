import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const origin = 'https://kotoba.example';
const navigation = (url: string) => ({ url, method: 'GET', mode: 'navigate' });

class MemoryCache {
  entries = new Map<string, Response>();

  async add(input: string | Request) {
    const request = typeof input === 'string' ? new Request(new URL(input, origin)) : input;
    const response = await this.fetcher(request);
    if (!response.ok) throw new Error(`Unable to cache ${request.url}`);
    await this.put(request, response);
  }

  constructor(private fetcher: (request: Request) => Promise<Response>) {}

  async addAll(inputs: string[]) { await Promise.all(inputs.map(input => this.add(input))); }
  async put(input: string | Request, response: Response) {
    const request = typeof input === 'string' ? new Request(new URL(input, origin)) : input;
    this.entries.set(request.url, response.clone());
  }
  async match(input: string | Request) {
    const url = typeof input === 'string' ? new URL(input, origin).href : input.url;
    return this.entries.get(url)?.clone();
  }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
}

async function createWorker(fetcher: (request: Request) => Promise<Response>) {
  const listeners = new Map<string, (event: any) => void>();
  const cacheMap = new Map<string, MemoryCache>();
  const cacheStorage = {
    async open(name: string) {
      let cache = cacheMap.get(name);
      if (!cache) { cache = new MemoryCache(fetcher); cacheMap.set(name, cache); }
      return cache;
    },
    async keys() { return [...cacheMap.keys()]; },
    async match(input: string | Request) {
      for (const cache of cacheMap.values()) { const response = await cache.match(input); if (response) return response; }
      return undefined;
    },
    async delete(name: string) { return cacheMap.delete(name); },
  };
  const self = {
    location: { origin },
    clients: { claim: async () => undefined },
    skipWaiting: () => undefined,
    addEventListener: (name: string, listener: (event: any) => void) => listeners.set(name, listener),
  };
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { self, caches: cacheStorage, fetch: fetcher, URL, Request, Response, Promise });
  return { listeners, cacheMap, cacheStorage };
}

async function dispatch(worker: Awaited<ReturnType<typeof createWorker>>, name: string, values: Record<string, unknown> = {}) {
  const pending: Promise<unknown>[] = [];
  let responsePromise: Promise<Response> | undefined;
  const event = {
    ...values,
    waitUntil(promise: Promise<unknown>) { pending.push(promise); },
    respondWith(promise: Promise<Response>) { responsePromise = promise; },
  };
  worker.listeners.get(name)?.(event);
  await Promise.all(pending);
  return responsePromise ? responsePromise : undefined;
}

test('offline navigation returns the cached root page', async () => {
  let available = true;
  const worker = await createWorker(async () => {
    if (!available) throw new Error('offline');
    return new Response('clean app', { status: 200 });
  });
  await dispatch(worker, 'install');
  available = false;
  const response = await dispatch(worker, 'fetch', { request: navigation(`${origin}/`) });
  assert.equal(await (response as Response).text(), 'clean app');
});

test('a server error navigation falls back to the previously cached root', async () => {
  let status = 200;
  const worker = await createWorker(async () => new Response(status === 200 ? 'clean app' : 'temporary error', { status }));
  await dispatch(worker, 'install');
  status = 503;
  const response = await dispatch(worker, 'fetch', { request: navigation(`${origin}/`) });
  assert.equal(await (response as Response).text(), 'clean app');
});

test('API, non-GET, and cross-origin requests are not intercepted', async () => {
  const worker = await createWorker(async () => new Response('network'));
  for (const request of [
    new Request(`${origin}/api/status`),
    new Request(`${origin}/_next/static/app.js`, { method: 'POST' }),
    new Request('https://other.example/_next/static/app.js'),
  ]) {
    assert.equal(await dispatch(worker, 'fetch', { request }), undefined);
  }
});

test('a fetched static asset remains available when the network fails', async () => {
  let available = true;
  const worker = await createWorker(async () => {
    if (!available) throw new Error('offline');
    return new Response('bundle');
  });
  const request = new Request(`${origin}/_next/static/app.js`);
  const first = await dispatch(worker, 'fetch', { request });
  assert.equal(await (first as Response).text(), 'bundle');
  available = false;
  const second = await dispatch(worker, 'fetch', { request });
  assert.equal(await (second as Response).text(), 'bundle');
});

test('asset priming caches fonts referenced by fetched same-origin stylesheets', async () => {
  let available = true;
  const fetched: string[] = [];
  const worker = await createWorker(async request => {
    if (!available) throw new Error('offline');
    fetched.push(request.url);
    if (request.url.endsWith('.css')) return new Response("@font-face{src:url('../media/kana.woff2')} @font-face{src:url('https://fonts.example/remote.woff2')} @font-face{src:url('/api/font')}");
    return new Response('font');
  });
  const cache = await worker.cacheStorage.open('kotoba-shell-v11');
  await cache.put('/', new Response('clean app'));
  await dispatch(worker, 'message', { data: { type: 'CACHE_ASSETS', urls: [`${origin}/_next/static/css/app.css`, 'https://fonts.example/remote.css', `${origin}/api/app.css`] } });
  assert.deepEqual(fetched, [`${origin}/_next/static/css/app.css`, `${origin}/_next/static/media/kana.woff2`]);
  available = false;
  const response = await dispatch(worker, 'fetch', { request: new Request(`${origin}/_next/static/media/kana.woff2`) });
  assert.equal(await (response as Response).text(), 'font');
});

test('activation preserves dictionaries and removes older shell caches', async () => {
  const worker = await createWorker(async () => new Response('network'));
  const oldShell = await worker.cacheStorage.open('kotoba-shell-v9');
  await oldShell.put('/_next/static/old.js', new Response('old shell'));
  await oldShell.put('/furigana/dictionary.gz', new Response('dictionary'));
  await dispatch(worker, 'activate');
  assert.deepEqual(await worker.cacheStorage.keys(), ['japanese-dictionaries-v1']);
  assert.equal(await (await worker.cacheStorage.match('/furigana/dictionary.gz'))?.text(), 'dictionary');
});

test('an auth callback does not replace the clean cached root', async () => {
  const worker = await createWorker(async request => new Response(request.url.includes('auth=') ? 'account callback' : 'clean app'));
  await dispatch(worker, 'install');
  const response = await dispatch(worker, 'fetch', { request: navigation(`${origin}/?auth=success`) });
  assert.equal(await (response as Response).text(), 'account callback');
  const cached = await worker.cacheStorage.match('/');
  assert.equal(await cached?.text(), 'clean app');
});
