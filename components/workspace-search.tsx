'use client';

import type { Ref } from 'react';
import { ArrowDownWideNarrow, Search } from 'lucide-react';
import type { ReadingContext } from '@/lib/library-view';
import './workspace-search.css';

type Props = {
  home: boolean;
  value: string;
  sort: ReadingContext['sort'];
  onChange: (value: string) => void;
  onSortChange: (value: ReadingContext['sort']) => void;
  actionsRef: Ref<HTMLDivElement>;
};

// The input stays mounted while its layout changes, including during IME composition.
export function WorkspaceSearch({ home, value, sort, onChange, onSortChange, actionsRef }: Props) {
  return <div className={`workspace-search ${home ? 'is-home' : ''}`}>
    <div className="library-search-group">
      <label className="search-field library-search"><Search size={20} /><input id="library-search" type="search" placeholder="Word, reading or romaji…" value={value} onChange={event => onChange(event.target.value)} aria-label="Search notes" autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
      <label className="library-sort" inert={home} aria-hidden={home} title={`Sort by ${sort === 'japanese' ? 'Japanese' : sort === 'meaning' ? 'translation' : 'date added'}`}><ArrowDownWideNarrow size={17} /><select value={sort} onChange={event => onSortChange(event.target.value as ReadingContext['sort'])} aria-label="Sort notes"><option value="japanese">Japanese</option><option value="meaning">Translation</option><option value="added">Date added</option></select></label>
    </div>
    <div ref={actionsRef} className="library-search-actions" />
  </div>;
}
