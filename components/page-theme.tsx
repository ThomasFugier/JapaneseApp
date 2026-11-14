'use client';

import { useId } from 'react';
import { Check } from 'lucide-react';
import type { PageTheme } from './use-workspace-context';
import { SeasonalArt } from './seasonal-art';
import './page-theme.css';

const themes = [{ id: 'plain', name: 'Plain' }, { id: 'waves', name: 'Waves' }, { id: 'sakura', name: 'Sakura' }, { id: 'maple', name: 'Maple' }] as const;

function ThemeArt({ theme, side = 'left', preview = false }: { theme: PageTheme; side?: 'left' | 'right'; preview?: boolean }) {
  const id = useId();
  if (theme === 'plain') return null;
  if (theme !== 'waves') return <SeasonalArt theme={theme} side={side} preview={preview} />;
  return <svg width="100%" height="100%" aria-hidden="true" focusable="false">
    <defs>
      {theme === 'waves' && <>
        <g id={`${id}-fan`} fill="none" stroke="currentColor" strokeWidth="3.3">
          <path d="M-80 0a80 80 0 0 1 160 0" fill="white" />
          <path d="M-60 0a60 60 0 0 1 120 0M-40 0a40 40 0 0 1 80 0M-20 0a20 20 0 0 1 40 0" />
        </g>
        <pattern id={`${id}-pattern`} width="160" height="80" patternUnits="userSpaceOnUse" patternTransform="scale(.6)">
          <use href={`#${id}-fan`} x="0" y="0" /><use href={`#${id}-fan`} x="160" y="0" />
          <use href={`#${id}-fan`} x="80" y="40" />
          <use href={`#${id}-fan`} x="0" y="80" /><use href={`#${id}-fan`} x="160" y="80" />
          <use href={`#${id}-fan`} x="80" y="120" />
        </pattern>
      </>}

    </defs>
    <rect width="100%" height="100%" fill={`url(#${id}-pattern)`} />
  </svg>;
}

export function PageBackground({ theme }: { theme: PageTheme }) {
  if (theme === 'plain') return null;
  return <div className="page-background" data-theme={theme} aria-hidden="true"><div className="page-background-side"><ThemeArt theme={theme} /></div><div className="page-background-side"><ThemeArt theme={theme} side="right" /></div></div>;
}

export function PageThemePicker({ value, onChange }: { value: PageTheme; onChange: (theme: PageTheme) => void }) {
  return <section className="appearance-settings" aria-label="Appearance"><h3>Background</h3><div className="page-theme-options" role="group" aria-label="Page background">{themes.map(theme => <button key={theme.id} type="button" className="page-theme-option" aria-label={`${theme.name} background`} aria-pressed={value === theme.id} onClick={() => onChange(theme.id)}><span className="page-theme-preview" data-theme={theme.id} aria-hidden="true"><ThemeArt theme={theme.id} preview /></span><span className="page-theme-label">{theme.name}{value === theme.id && <Check size={13} />}</span></button>)}</div></section>;
}
