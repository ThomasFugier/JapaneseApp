'use client';

import { useId } from 'react';
import { Check } from 'lucide-react';
import type { PageTheme } from './use-workspace-context';
import './page-theme.css';

const themes = [{ id: 'plain', name: 'Plain' }, { id: 'waves', name: 'Waves' }, { id: 'sakura', name: 'Sakura' }, { id: 'maple', name: 'Maple' }] as const;

function ThemeArt({ theme }: { theme: PageTheme }) {
  const id = useId();
  if (theme === 'plain') return null;
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
      {theme === 'sakura' && <>
        <path id={`${id}-petal`} d="M0 0C-15-10-23-29-9-39L0-34 9-39C23-29 15-10 0 0Z" />
        <g id={`${id}-flower`} fill="#f4dfe6" stroke="#d8b2c0" strokeWidth="1">
          {[0, 72, 144, 216, 288].map(angle => <use key={angle} href={`#${id}-petal`} transform={`rotate(${angle})`} />)}
          <circle r="4" fill="#d4a4b4" stroke="none" />
          {[0, 72, 144, 216, 288].map(angle => <path key={angle} d="M0-6V-15M-2-15H2" fill="none" transform={`rotate(${angle})`} />)}
        </g>
        <pattern id={`${id}-pattern`} width="320" height="820" patternUnits="userSpaceOnUse">
          <path d="M-25 350Q20 200 150 75M24 229Q44 173 27 118M67 164Q114 155 169 160M-40 789Q28 620 148 477M38 646Q93 632 156 640" fill="none" stroke="#d7c6cd" strokeWidth="1.3" />
          <use href={`#${id}-flower`} transform="translate(39 127) rotate(-18) scale(.8)" />
          <use href={`#${id}-flower`} transform="translate(132 91) rotate(12) scale(.65)" />
          <use href={`#${id}-flower`} transform="translate(157 162) rotate(35) scale(.55)" />
          <use href={`#${id}-flower`} transform="translate(65 610) rotate(10) scale(.9)" />
          <use href={`#${id}-flower`} transform="translate(145 490) rotate(-20) scale(.7)" />
          <use href={`#${id}-petal`} fill="#f0dce4" transform="translate(234 320) rotate(24) scale(.4)" />
          <use href={`#${id}-petal`} fill="#f0dce4" transform="translate(105 408) rotate(114) scale(.3)" />
          <use href={`#${id}-petal`} fill="#f0dce4" transform="translate(236 745) rotate(55) scale(.35)" />
        </pattern>
      </>}
      {theme === 'maple' && <>
        <g id={`${id}-leaf`} fill="#f0e2d5" stroke="#d6b7a1" strokeWidth="1" strokeLinejoin="round">
          <path d="M0 20-9 24-8 12-29 7-20 0-35-15-20-13-22-29-9-19 0-47 9-19 22-29 20-13 35-15 20 0 29 7 8 12 9 24Z" />
          <path d="M0 37V-32M0 10-23-10M0 10 23-10M0 2-15-20M0 2 15-20" fill="none" />
        </g>
        <pattern id={`${id}-pattern`} width="320" height="820" patternUnits="userSpaceOnUse">
          <path d="M-30 368Q17 260 112 168M-8 319Q51 310 95 320M-25 804Q12 724 106 652" fill="none" stroke="#dfcfc1" strokeWidth="1.2" />
          <use href={`#${id}-leaf`} transform="translate(109 155) rotate(28) scale(.95)" />
          <use href={`#${id}-leaf`} transform="translate(62 249) rotate(-29) scale(.65)" />
          <use href={`#${id}-leaf`} transform="translate(100 325) rotate(85) scale(.55)" />
          <use href={`#${id}-leaf`} transform="translate(224 439) rotate(-36) scale(.6)" />
          <use href={`#${id}-leaf`} transform="translate(69 695) rotate(-15) scale(1.1)" />
          <use href={`#${id}-leaf`} transform="translate(201 763) rotate(56) scale(.55)" />
          <use href={`#${id}-leaf`} transform="translate(245 72) rotate(49) scale(.35)" />
        </pattern>
      </>}
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id}-pattern)`} />
  </svg>;
}

export function PageBackground({ theme }: { theme: PageTheme }) {
  if (theme === 'plain') return null;
  return <div className="page-background" data-theme={theme} aria-hidden="true"><div className="page-background-side"><ThemeArt theme={theme} /></div><div className="page-background-side"><ThemeArt theme={theme} /></div></div>;
}

export function PageThemePicker({ value, onChange }: { value: PageTheme; onChange: (theme: PageTheme) => void }) {
  return <section className="appearance-settings" aria-label="Appearance"><h3>Background</h3><div className="page-theme-options" role="group" aria-label="Page background">{themes.map(theme => <button key={theme.id} type="button" className="page-theme-option" aria-label={`${theme.name} background`} aria-pressed={value === theme.id} onClick={() => onChange(theme.id)}><span className="page-theme-preview" data-theme={theme.id} aria-hidden="true"><ThemeArt theme={theme.id} /></span><span className="page-theme-label">{theme.name}{value === theme.id && <Check size={13} />}</span></button>)}</div></section>;
}
