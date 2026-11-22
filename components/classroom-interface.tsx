'use client';

import { Check } from 'lucide-react';
import type { InterfaceStyle, WorkspaceTab } from './use-workspace-context';

const icons: Record<WorkspaceTab, string> = { home: '🏡', review: '📇', library: '📚', lessons: '🎓', writing: '✏️', stats: '📊', reference: 'あ', stories: '📖' };

export function ClassroomEmoji({ children }: { children: string }) {
  return <span className="classroom-emoji" aria-hidden="true">{children}</span>;
}

export function ClassroomNavIcon({ tab }: { tab: WorkspaceTab }) {
  return <span className={`classroom-nav-icon classroom-nav-${tab}`} aria-hidden="true"><span className={`classroom-nav-tile ${tab === 'reference' ? 'classroom-kana-icon' : 'classroom-emoji'}`} lang={tab === 'reference' ? 'ja' : undefined}>{icons[tab]}</span></span>;
}

function InterfacePreview({ classroom }: { classroom: boolean }) {
  return <svg viewBox="0 0 240 100" aria-hidden="true">
    <rect width="240" height="100" rx="8" fill={classroom ? '#fff5e3' : '#fff'}/>
    <path d="M12 21H228" stroke={classroom ? '#dfd8c3' : '#ececf0'}/>
    <circle cx="15" cy="12" r="4" fill={classroom ? '#53775e' : '#c70035'}/>
    {[112, 133, 154, 175].map(x => <rect key={x} x={x} y="8" width="14" height="7" rx="3" fill={classroom ? '#c2d6b5' : '#efeff2'}/>)}
    <rect x="12" y="32" width="132" height="55" rx={classroom ? 10 : 5} fill={classroom ? '#245e50' : '#fff'} stroke={classroom ? '#9caa87' : '#e4e4ea'} strokeWidth={classroom ? 3 : 1}/>
    <path d="M25 47H65M25 57H90" stroke={classroom ? '#e9edcf' : '#d3d3dc'} strokeWidth="4" strokeLinecap="round"/>
    <rect x="25" y="68" width="44" height="10" rx="5" fill={classroom ? '#ffd45c' : '#c70035'}/>
    <rect x="156" y="32" width="72" height="55" rx="7" fill={classroom ? '#fffef8' : '#fafafb'} stroke={classroom ? '#dfd8c3' : '#e4e4ea'}/>
    <path d="M168 46H209M168 57H217M168 68H201" stroke={classroom ? '#d7dfc4' : '#e4e4ea'} strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}

export function InterfaceStylePicker({ value, onChange }: { value: InterfaceStyle; onChange: (value: InterfaceStyle) => void }) {
  return <section className="interface-picker" aria-label="Interface style">
    <h3>Interface</h3>
    <div className="interface-options">{(['classic', 'classroom'] as const).map(style => <button key={style} type="button" className="interface-option" aria-pressed={value === style} onClick={() => onChange(style)}>
      <InterfacePreview classroom={style === 'classroom'}/><span>{style === 'classic' ? 'Classic' : 'Classroom'}{value === style && <Check size={15}/>}</span>
    </button>)}</div>
  </section>;
}

export function ClassroomSupplies() {
  return <span className="classroom-supplies classroom-emoji" aria-hidden="true">📝</span>;
}
