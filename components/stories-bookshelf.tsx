'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import { storyCategoryText, type Story } from '@/lib/stories';
import './stories-bookshelf.css';

type Props = {
  stories: readonly Story[];
  readIds: readonly string[];
  onOpen: (story: Story, anchor: HTMLButtonElement) => void;
};
const SPINE_WIDTHS = [54, 60, 48, 64, 52];

function BookRow({ stories, readIds, onOpen, offset, total }: Props & { offset: number; total: number }) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = stories.find(story => story.id === previewId) ?? stories[0];
  if (!preview) return null;
  return <div className="story-shelf-row">
    <div className="story-shelf-track">
      {stories.map((story, index) => <button type="button" id={`story-spine-${story.id}`} key={story.id}
        className={`story-volume story-volume-size-${(offset + index) % 5}`}
        style={{ '--title-length': Array.from(story.title).length, '--spine-width': `${SPINE_WIDTHS[(offset + index) % SPINE_WIDTHS.length]}px` } as CSSProperties}
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
  const shelf = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = shelf.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rows: { offset: number; stories: Story[] }[] = [];
  const available = width ? Math.max(64, width - 16) : Infinity;
  let used = 0;
  stories.forEach((story, index) => {
    const bookWidth = SPINE_WIDTHS[index % SPINE_WIDTHS.length];
    if (!rows.length || used + bookWidth > available) { rows.push({ offset: index, stories: [] }); used = 0; }
    rows[rows.length - 1].stories.push(story);
    used += bookWidth;
  });

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.story-volume')];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const row = buttons[index].closest('.story-shelf-row');
      const adjacent = event.key === 'ArrowUp' ? row?.previousElementSibling : row?.nextElementSibling;
      const candidates = [...(adjacent?.querySelectorAll<HTMLButtonElement>('.story-volume') ?? [])];
      const center = (button: HTMLButtonElement) => { const box = button.getBoundingClientRect(); return box.left + box.width / 2; };
      const x = center(buttons[index]);
      candidates.sort((a, b) => Math.abs(center(a) - x) - Math.abs(center(b) - x))[0]?.focus();
      return;
    }
    const step = event.key === 'ArrowLeft' ? -1 : 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + step));
    buttons[next]?.focus();
  }
  return <div ref={shelf} className="stories-desktop-bookshelf" aria-label="Sélection d’histoires" onKeyDown={moveFocus}>
    {rows.map(row => <BookRow key={row.stories[0].id} stories={row.stories} readIds={readIds} onOpen={onOpen} offset={row.offset} total={stories.length} />)}
  </div>;
}
