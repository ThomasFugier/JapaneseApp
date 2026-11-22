'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Story } from '@/lib/stories';
import './stories-bookshelf.css';

type Props = {
  stories: readonly Story[];
  readIds: readonly string[];
  onOpen: (story: Story, anchor: HTMLButtonElement) => void;
  renderCover: (story: Story) => ReactNode;
};
type Drag = { pointerId: number; x: number; y: number; left: number; moved: boolean };
const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

export function StoriesBookshelf({ stories, readIds, onOpen, renderCover }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const preview = stories.find(story => story.id === previewId) ?? stories[0];
  const visibleIds = stories.map(story => story.id).join('|');

  function syncEdges() {
    const element = viewport.current;
    if (!element) return;
    const start = element.scrollLeft < 2;
    const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
    setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
  }

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    element.scrollLeft = 0;
    syncEdges();
    const observer = new ResizeObserver(syncEdges);
    observer.observe(element);
    if (track.current) observer.observe(track.current);
    return () => observer.disconnect();
  }, [visibleIds]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
    suppressClick.current = false;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, moved: false };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = event.clientX - gesture.x;
    if (!gesture.moved) {
      if (Math.abs(distance) < 7 || Math.abs(distance) < Math.abs(event.clientY - gesture.y)) return;
      gesture.moved = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = gesture.left - distance;
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.story-volume')];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
    buttons[next]?.focus({ preventScroll: true });
  }

  function previewBook(story: Story, button: HTMLButtonElement) {
    setPreviewId(story.id);
    if (drag.current) return;
    requestAnimationFrame(() => {
      if (button.isConnected && document.activeElement === button) button.scrollIntoView({ block: 'nearest', inline: 'center', behavior: scrollBehavior() });
    });
  }

  function browse(direction: number) {
    const element = viewport.current;
    if (element) element.scrollBy({ left: direction * Math.max(300, element.clientWidth * .7), behavior: scrollBehavior() });
  }

  if (!preview) return null;
  return <div className="stories-desktop-bookshelf">
    <div className={`story-bookcase${dragging ? ' is-dragging' : ''}`}>
      <div ref={viewport} className="story-shelf-viewport" aria-label="Étagère des histoires" onScroll={syncEdges} onKeyDown={moveFocus}
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}
        onPointerCancel={event => { suppressClick.current = false; finishDrag(event); }}
        onLostPointerCapture={finishDrag}
        onPointerLeave={() => { if (!drag.current?.moved) drag.current = null; }}
        onDragStart={event => event.preventDefault()}
        onClickCapture={event => {
          if (suppressClick.current && event.detail !== 0) {
            event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
          }
        }}>
        <div ref={track} className="story-shelf-track">
          {stories.map((story, index) => {
            const isRead = readIds.includes(story.id);
            return <button type="button" id={`story-spine-${story.id}`} key={story.id}
              className={`story-volume story-volume-size-${index % 5}${preview.id === story.id ? ' is-preview' : ''}`}
              style={{ '--title-length': Array.from(story.title).length } as CSSProperties}
              aria-label={`Lire ${story.subtitle}`}
              onPointerMove={event => { if (event.pointerType === 'mouse' && !drag.current?.moved && preview.id !== story.id) setPreviewId(story.id); }}
              onFocus={event => previewBook(story, event.currentTarget)} onClick={event => onOpen(story, event.currentTarget)}>
              <span className={`story-spine story-cover-${story.theme}`} aria-hidden="true">
                <span className="story-spine-cap"><BookOpen size={15} strokeWidth={1.2} /></span>
                <span className="story-spine-title" lang="ja">{story.title}</span>
                <span className="story-spine-level">{isRead ? <Check size={14} /> : story.level}</span>
              </span>
              <span className="story-volume-face" aria-hidden="true">{renderCover(story)}</span>
            </button>;
          })}
        </div>
      </div>
      <div className="story-shelf-ledge" aria-hidden="true" />
    </div>
    <div className="story-shelf-caption">
      <div className="story-shelf-preview" aria-live="off"><span className="story-shelf-level">{preview.level}</span><div><strong>{preview.subtitle}</strong><p>{preview.description}</p></div></div>
      <div className="story-shelf-controls" role="group" aria-label="Parcourir l’étagère">
        <button type="button" aria-label="Livres précédents" disabled={edges.start} onClick={() => browse(-1)}><ChevronLeft size={20} /></button>
        <button type="button" aria-label="Livres suivants" disabled={edges.end} onClick={() => browse(1)}><ChevronRight size={20} /></button>
      </div>
    </div>
  </div>;
}
