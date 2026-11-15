import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWorkspaceScrollTop, isWorkspaceScrollEvent, scrollWorkspaceTo } from '../lib/workspace-scroll';

function installBrowser(width: number, main?: { scrollTop: number; scrollTo: (options: ScrollToOptions) => void }) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const windowMock = {
    innerWidth: width,
    scrollY: 73,
    scrollCalls: [] as ScrollToOptions[],
    scrollTo(options: ScrollToOptions) { this.scrollCalls.push(options); },
  };
  const documentMock = { getElementById: (id: string) => id === 'main-content' ? main ?? null : null };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowMock });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock });
  return () => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  };
}

test('mobile uses main-content and falls back to window before it mounts', () => {
  const main = { scrollTop: 24, calls: [] as ScrollToOptions[], scrollTo(options: ScrollToOptions) { this.calls.push(options); } };
  const restore = installBrowser(390, main);
  try {
    assert.equal(getWorkspaceScrollTop(), 24);
    scrollWorkspaceTo(0);
    assert.deepEqual(main.calls, [{ top: 0, behavior: 'instant' }]);
    const mainEvent = { target: main } as unknown as Event;
    assert.equal(isWorkspaceScrollEvent(mainEvent), true);
    assert.equal(isWorkspaceScrollEvent({ target: {} } as Event), false);
    restore();
    const noMainRestore = installBrowser(390);
    try {
      assert.equal(getWorkspaceScrollTop(), 73);
      scrollWorkspaceTo(0, 'smooth');
      assert.deepEqual((window as unknown as { scrollCalls: ScrollToOptions[] }).scrollCalls, [{ top: 0, behavior: 'smooth' }]);
    } finally { noMainRestore(); }
  } finally { restore(); }
});

test('desktop uses document window scroll', () => {
  const restore = installBrowser(1024, { scrollTop: 24, scrollTo() {} });
  try {
    assert.equal(getWorkspaceScrollTop(), 73);
    scrollWorkspaceTo(12);
    assert.deepEqual((window as unknown as { scrollCalls: ScrollToOptions[] }).scrollCalls, [{ top: 12, behavior: 'instant' }]);
    assert.equal(isWorkspaceScrollEvent({ target: window } as unknown as Event), true);
  } finally { restore(); }
});

test('helpers are safe during server rendering', () => {
  const restore = installBrowser(800);
  Reflect.deleteProperty(globalThis, 'window');
  try {
    assert.equal(getWorkspaceScrollTop(), 0);
    scrollWorkspaceTo(10);
    assert.equal(isWorkspaceScrollEvent({} as Event), false);
  } finally { restore(); }
});
