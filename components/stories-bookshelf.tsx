'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { storyCategoryText, type Story } from '@/lib/stories';
import './stories-bookshelf.css';

type Props = {
  stories: readonly Story[];
  readIds: readonly string[];
  onOpen: (story: Story, anchor: HTMLButtonElement) => void;
};
const SPINE_WIDTHS = [54, 60, 48, 64, 52];

type Preview = { story: Story; anchor: HTMLButtonElement };
function BookTooltip({ preview, id, onEnter, onLeave }: { preview: Preview; id: string; onEnter: () => void; onLeave: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  useLayoutEffect(() => {
    function place() {
      if (!panel.current || !preview.anchor.isConnected) return;
      const anchor = preview.anchor.getBoundingClientRect(), box = panel.current.getBoundingClientRect();
      const view = window.visualViewport;
      const left = view?.offsetLeft ?? 0, top = view?.offsetTop ?? 0;
      const right = left + (view?.width ?? window.innerWidth), bottom = top + (view?.height ?? window.innerHeight);
      const below = anchor.bottom + 10;
      setPosition({
        left: Math.max(left + 12, Math.min(anchor.left + anchor.width / 2 - box.width / 2, right - box.width - 12)),
        top: Math.max(top + 12, Math.min(below + box.height <= bottom - 12 ? below : anchor.top - box.height - 10, bottom - box.height - 12)),
      });
    }
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [preview]);
  return createPortal(<div ref={panel} id={id} role="tooltip" className="story-book-tooltip" style={position} lang="fr" onPointerEnter={onEnter} onPointerLeave={onLeave}>
    <strong>{preview.story.subtitle}</strong>
    <span>{preview.story.level}{preview.story.categories?.length ? ` · ${storyCategoryText(preview.story)}` : ''}</span>
    <p>{preview.story.description}</p>
  </div>, document.body);
}

function BookRow({ stories, readIds, onOpen, offset, previewId, tooltipId, onPreview, onLeave }: Props & { offset: number; previewId?: string; tooltipId: string; onPreview: (story: Story, anchor: HTMLButtonElement, focus?: boolean) => void; onLeave: (anchor: HTMLButtonElement) => void }) {
  return <div className="story-shelf-row">
    <div className="story-shelf-track">
      {stories.map((story, index) => <button type="button" id={`story-spine-${story.id}`} key={story.id}
        className={`story-volume story-volume-size-${(offset + index) % 5}`}
        style={{ '--title-length': Array.from(story.title).length, '--spine-width': `${SPINE_WIDTHS[(offset + index) % SPINE_WIDTHS.length]}px` } as CSSProperties}
        aria-label={`Lire ${story.subtitle}`}
        aria-describedby={previewId === story.id ? tooltipId : undefined}
        onPointerMove={event => { if (event.pointerType === 'mouse') onPreview(story, event.currentTarget); }}
        onPointerLeave={event => onLeave(event.currentTarget)} onBlur={event => onLeave(event.currentTarget)}
        onFocus={event => onPreview(story, event.currentTarget, true)} onClick={event => onOpen(story, event.currentTarget)}>
        <span className={`story-spine story-cover-${story.theme}`} aria-hidden="true">
          <span className="story-spine-cap">{String(offset + index + 1).padStart(2, '0')}</span>
          <span className="story-spine-title" lang="ja">{story.title}</span>
          <span className="story-spine-level">{readIds.includes(story.id) ? <Check size={14} /> : story.level}</span>
        </span>
      </button>)}
    </div>
  </div>;
}

export function StoriesBookshelf({ stories, readIds, onOpen }: Props) {
  const shelf = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const dismissed = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tooltipId = useId();
  const visibleIds = stories.map(story => story.id).join('|');
  const cancelClose = () => clearTimeout(closeTimer.current);
  function showPreview(story: Story, anchor: HTMLButtonElement, focus = false) {
    cancelClose();
    if (focus) dismissed.current = null;
    if (dismissed.current === anchor) return;
    setPreview(current => current?.anchor === anchor ? current : { story, anchor });
  }
  function leavePreview(anchor: HTMLButtonElement) {
    dismissed.current = null;
    cancelClose();
    if (document.activeElement === anchor) return;
    closeTimer.current = setTimeout(() => setPreview(null), 140);
  }
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useLayoutEffect(() => { setPreview(null); }, [width, visibleIds]);
  useEffect(() => {
    if (!preview) return;
    function dismiss(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') { dismissed.current = preview!.anchor; clearTimeout(closeTimer.current); setPreview(null); }
    }
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [preview]);
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
    {rows.map(row => <BookRow key={row.stories[0].id} stories={row.stories} readIds={readIds} onOpen={onOpen} offset={row.offset} previewId={preview?.story.id} tooltipId={tooltipId} onPreview={showPreview} onLeave={leavePreview} />)}
    {preview && <BookTooltip preview={preview} id={tooltipId} onEnter={cancelClose} onLeave={() => leavePreview(preview.anchor)} />}
  </div>;
}
