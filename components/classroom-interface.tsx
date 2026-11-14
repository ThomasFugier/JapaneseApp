'use client';

import { BarChart3, BookOpen, Check, GraduationCap, Home, Layers, PenLine } from 'lucide-react';
import type { InterfaceStyle, WorkspaceTab } from './use-workspace-context';

const icons = { home: Home, review: Layers, library: BookOpen, lessons: GraduationCap, writing: PenLine, stats: BarChart3 };

export function ClassroomNavIcon({ tab }: { tab: WorkspaceTab }) {
  const Icon = icons[tab];
  return <span className={`classroom-nav-icon classroom-nav-${tab}`} aria-hidden="true"><Icon size={19} strokeWidth={2.1}/></span>;
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
  return <svg className="classroom-supplies" viewBox="0 0 210 190" fill="none" aria-hidden="true">
    <g transform="rotate(9 120 90)"><rect x="76" y="20" width="99" height="137" rx="9" fill="#7bc4a5"/><rect x="65" y="15" width="99" height="137" rx="9" fill="#fff3bb"/><path d="M81 15V152" stroke="#d9b1a0" strokeWidth="2"/>{[42,62,82,102,122].map(y => <path key={y} d={`M93 ${y}H147`} stroke="#d6d5ac" strokeWidth="2"/>)}<rect x="102" y="5" width="28" height="20" rx="5" fill="#f4a37d"/></g>
    <g transform="rotate(28 57 125)"><path d="M51 62H64V151L57.5 170L51 151Z" fill="#ffd35a"/><path d="M51 151H64L57.5 170Z" fill="#e5c6a0"/><path d="M55 163H60L57.5 170Z" fill="#405749"/><path d="M57 70V149" stroke="#c3a455" strokeWidth="2"/><rect x="51" y="55" width="13" height="15" rx="3" fill="#e1a598"/></g>
    <rect x="115" y="165" width="48" height="10" rx="4" fill="#f5f1dc" transform="rotate(-7 115 165)"/>
    <rect x="162" y="149" width="31" height="21" rx="5" fill="#d7aa7a" transform="rotate(12 162 149)"/>
  </svg>;
}
