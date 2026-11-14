'use client';

import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// Each view owns its visibility; only the control moves into the shared toolbar.
export const TranslationTargets = createContext<readonly (HTMLElement | null)[]>([]);

export function ContextualTranslation({ visible, onChange }: { visible: boolean; onChange: (visible: boolean) => void }) {
  const targets = useContext(TranslationTargets);
  return <>{targets.map((target, index) => target && createPortal(
    <button type="button" className="furigana-toggle contextual-translation-toggle" role="switch" aria-label="Translation" aria-checked={visible} title={visible ? 'Hide translations' : 'Show translations'} onClick={() => onChange(!visible)}>
      <span>Translation</span><span className="furigana-switch" aria-hidden="true"><i /></span>
    </button>, target, String(index),
  ))}</>;
}
