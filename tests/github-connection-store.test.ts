import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { forgetGitHubConnection, loadGitHubConnection, saveGitHubConnection } from '../lib/github-connection-store';
import { type GitHubConfig } from '../lib/github-client';
import { backupBytes, csvText, readBackup } from '../lib/portability';
import { seedSnapshot } from '../lib/seed';

const key = 'japanese-github-connection-v1';
const config: GitHubConfig = { owner: 'connection-owner', repo: 'connection-data', branch: 'main', token: 'test-token' };
const memoryStorage = (values = new Map<string, string>()) => ({
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
});

test('a new storage instance restores only the normalized saved connection', () => {
  const values = new Map<string, string>();
  const input = { ...config, owner: ' connection-owner', repo: 'connection-data.git ', branch: ' ', token: ' test-token ' };
  assert.deepEqual(saveGitHubConnection(input, memoryStorage(values)), config);
  assert.deepEqual(loadGitHubConnection(memoryStorage(values)), config);
  assert.equal(input.token, ' test-token ');
  assert.deepEqual([...values.keys()], [key]);
  const loaded = loadGitHubConnection(memoryStorage(values))!;
  loaded.token = 'test-token-mutated';
  assert.deepEqual(loadGitHubConnection(memoryStorage(values)), config);
});

test('saving replaces the repository, branch, and token; forgetting survives reload', () => {
  const values = new Map<string, string>();
  saveGitHubConnection(config, memoryStorage(values));
  const replacement = { owner: 'other-owner', repo: 'other-data', branch: 'study', token: 'test-token-new' };
  saveGitHubConnection(replacement, memoryStorage(values));
  assert.deepEqual(loadGitHubConnection(memoryStorage(values)), replacement);
  assert.ok(!values.get(key)!.includes('"test-token"'));
  forgetGitHubConnection(memoryStorage(values));
  assert.equal(loadGitHubConnection(memoryStorage(values)), null);
  assert.equal(values.size, 0);
});

test('malformed and invalid saved connections are ignored and cleaned without touching library data', () => {
  for (const saved of ['{', 'null', '[]', '"test-token"', '{}', JSON.stringify({ ...config, token: '' }), JSON.stringify({ ...config, token: 42 }), JSON.stringify({ ...config, branch: '../bad' }), JSON.stringify({ ...config, repo: '..' })]) {
    const values = new Map([[key, saved], ['japanese-library', 'existing-library']]);
    assert.equal(loadGitHubConnection(memoryStorage(values)), null);
    assert.equal(values.has(key), false);
    assert.equal(values.get('japanese-library'), 'existing-library');
  }
  const storage = memoryStorage();
  assert.equal(loadGitHubConnection(storage), null);
});

test('invalid credentials cannot overwrite a saved connection', () => {
  const values = new Map<string, string>();
  const storage = memoryStorage(values);
  saveGitHubConnection(config, storage);
  for (const invalid of [null, [], {}, { ...config, token: '' }, { ...config, token: 'test-token with-space' }, { ...config, token: 42 }, { ...config, owner: '../bad' }, { ...config, branch: '../bad' }]) {
    assert.throws(() => saveGitHubConnection(invalid as GitHubConfig, storage), error => error instanceof Error && !error.message.includes('test-token'));
    assert.deepEqual(loadGitHubConnection(storage), config);
  }
});

test('quota and access failures expose no stored credentials and never claim success', () => {
  const failure = () => { throw new Error(`Storage denied: ${config.token}`); };
  const values = new Map([[key, JSON.stringify(config)]]);
  assert.equal(loadGitHubConnection({ ...memoryStorage(values), getItem: failure }), null);
  assert.equal(values.has(key), true);
  const storage = { getItem: failure, setItem: failure, removeItem: failure };
  assert.equal(loadGitHubConnection(storage), null);
  assert.throws(() => saveGitHubConnection(config, storage), error => error instanceof Error && /could not be saved/.test(error.message) && !error.message.includes(config.token));
  assert.throws(() => forgetGitHubConnection(storage), error => error instanceof Error && /could not be forgotten/.test(error.message) && !error.message.includes(config.token));
  assert.equal(loadGitHubConnection({ ...storage, getItem: () => '{' }), null);
});

test('default storage is resolved safely at call time, including denied browser access', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    const storage = memoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    saveGitHubConnection(config);
    assert.deepEqual(loadGitHubConnection(), config);
    forgetGitHubConnection();
    assert.equal(loadGitHubConnection(), null);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error(`Access denied: ${config.token}`); } });
    assert.equal(loadGitHubConnection(), null);
    assert.throws(() => saveGitHubConnection(config), error => error instanceof Error && !error.message.includes(config.token));
    assert.throws(() => forgetGitHubConnection(), error => error instanceof Error && !error.message.includes(config.token));
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('saved connection stays outside library JSON, ZIP backups, and CSV exports', () => {
  const snapshot = seedSnapshot();
  const original = structuredClone(snapshot);
  const storage = memoryStorage();
  saveGitHubConnection(config, storage);
  const backup = backupBytes(snapshot);
  const files = unzipSync(backup);
  const exports = [JSON.stringify(snapshot), csvText(snapshot), ...Object.values(files).map(bytes => strFromU8(bytes))];
  for (const output of exports) {
    for (const credential of Object.values(config)) {
      if (credential !== 'main') assert.ok(!output.includes(credential));
    }
    assert.ok(!output.includes(key));
  }
  assert.deepEqual(readBackup(backup), original);
  assert.deepEqual(snapshot, original);
  assert.deepEqual(loadGitHubConnection(storage), config);
});
