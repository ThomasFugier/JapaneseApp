import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classroomTransition } from '../components/classroom-motion';

// Check navigation semantics even when snapshots are delayed or unavailable.
test('classroom transitions keep the latest intent and update once', async () => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const callbacks: (() => void)[] = [];
  let reduced = false, skipped = 0;
  const fakeDocument = { startViewTransition: (callback: () => void) => {
    callbacks.push(callback);
    return { skipTransition: () => skipped++, ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), finished: Promise.resolve() };
  } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: reduced }) } });
  try {
    const applied: string[] = [];
    classroomTransition(true, () => applied.push('old'));
    classroomTransition(true, () => applied.push('latest'));
    callbacks[0](); callbacks[1](); callbacks[1]();
    assert.deepEqual(applied, ['latest']);
    assert.equal(skipped, 1);
    classroomTransition(true, () => applied.push('cancelled'));
    classroomTransition(false, () => applied.push('classic'));
    callbacks[2]();
    assert.deepEqual(applied, ['latest', 'classic']);
    reduced = true;
    classroomTransition(true, () => applied.push('reduced'));
    assert.equal(applied.at(-1), 'reduced');
    assert.equal(callbacks.length, 3);
    reduced = false;
    Object.assign(fakeDocument, { startViewTransition: undefined });
    classroomTransition(true, () => applied.push('unsupported'));
    assert.equal(applied.at(-1), 'unsupported');
    Object.assign(fakeDocument, { startViewTransition: () => { throw new Error('Unavailable'); } });
    classroomTransition(true, () => applied.push('fallback'));
    assert.equal(applied.filter(value => value === 'fallback').length, 1);
    await Promise.resolve();
  } finally {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});
