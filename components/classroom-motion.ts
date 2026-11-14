'use client';

import { flushSync } from 'react-dom';

let pending: ViewTransition | undefined;
let revision = 0;

// Event handlers only. Animation is optional; navigation never depends on it.
export function classroomTransition(enabled: boolean, update: () => void) {
  const ticket = ++revision;
  pending?.skipTransition();
  if (!enabled || typeof document.startViewTransition !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  let applied = false;
  const apply = () => {
    if (ticket !== revision || applied) return;
    applied = true;
    flushSync(update);
  };
  try {
    const transition = document.startViewTransition(apply);
    pending = transition;
    // A skipped animation still applies its update. Never replay a failed save/action.
    void transition.ready.catch(() => {});
    void transition.updateCallbackDone.catch(() => {});
    void transition.finished.catch(() => {}).then(() => { if (pending === transition) pending = undefined; });
  } catch { if (!applied) apply(); }
}
