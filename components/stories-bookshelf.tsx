'use client';

import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import { storyCategoryText, type Story } from '@/lib/stories';
import './stories-bookshelf.css';

type Props = {
  stories: readonly Story[];
  readIds: readonly string[];
  onOpen: (story: Story, anchor: HTMLButtonElement) => void;
};
const BOOKS_PER_ROW = 12;

function BookRow({ stories, readIds, onOpen, offset, total }: Props & { offset: number; total: number }) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = stories.find(story => story.id === previewId) ?? stories[0];
  if (!preview) return null;
  return <div className="story-shelf-row">
    <div className="story-shelf-track">
      {stories.map((story, index) => <button type="button" id={`story-spine-${story.id}`} key={story.id}
        className={`story-volume story-volume-size-${(offset + index) % 5}`}
        style={{ '--title-length': Array.from(story.title).length } as CSSProperties}
        aria-label={`Lire ${story.subtitle}`}
        onPointerMove={event => { if (event.pointerType === 'mouse' && previewId !== story.id) setPreviewId(story.id); }}
        onFocus={() => setPreviewId(story.id)} onClick={event => onOpen(story, event.currentTarget)}>
        <span className={`story-spine story-cover-${story.theme}`} aria-hidden="true">
          <span className="story-spine-cap">{String(offset + index + 1).padStart(2, '0')}</span>
          <span className="story-spine-title" lang="ja">{story.title}</span>
          <span className="story-spine-level">{readIds.includes(story.id) ? <Check size={14} /> : story.level}</span>
        </span>
      </button>)}
    </div>
    <div className="story-shelf-caption">
      <div className="story-shelf-preview"><span className="story-shelf-level">{preview.level}</span><div><strong>{preview.subtitle}</strong>{preview.categories?.length ? <span className="story-category-labels">{storyCategoryText(preview)}</span> : null}<p>{preview.description}</p></div></div>
      <span className="story-shelf-position">{String(offset + stories.indexOf(preview) + 1).padStart(2, '0')}<span> / {total}</span></span>
    </div>
  </div>;
}

export function StoriesBookshelf({ stories, readIds, onOpen }: Props) {
  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.story-volume')];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === 'ArrowUp' ? -BOOKS_PER_ROW : event.key === 'ArrowDown' ? BOOKS_PER_ROW : event.key === 'ArrowLeft' ? -1 : 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + step));
    buttons[next]?.focus();
  }
  return <div className="stories-desktop-bookshelf" aria-label="Sélection d’histoires" onKeyDown={moveFocus}>
    {Array.from({ length: Math.ceil(stories.length / BOOKS_PER_ROW) }, (_, row) => <BookRow key={stories[row * BOOKS_PER_ROW].id} stories={stories.slice(row * BOOKS_PER_ROW, (row + 1) * BOOKS_PER_ROW)} readIds={readIds} onOpen={onOpen} offset={row * BOOKS_PER_ROW} total={stories.length} />)}
  </div>;
}
