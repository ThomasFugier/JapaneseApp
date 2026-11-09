'use client';

import type { JapaneseFont } from './use-workspace-context';

export function JapaneseFontToggle({ value, onChange }: { value: JapaneseFont; onChange: (value: JapaneseFont) => void }) {
  return <div className="japanese-font-toggle" role="group" aria-label="Japanese font">
    <button type="button" data-font="brush" aria-label="Brush font" title="Yuji Syuku · Brush" aria-pressed={value === 'brush'} onClick={() => onChange('brush')}><span lang="ja">あ</span></button>
    <button type="button" data-font="plain" aria-label="Plain font" title="Noto Sans JP · Plain" aria-pressed={value === 'plain'} onClick={() => onChange('plain')}><span lang="ja">あ</span></button>
  </div>;
}
