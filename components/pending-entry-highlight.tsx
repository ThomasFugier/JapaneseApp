'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import './pending-entry-highlight.css';

type Range = { start: number; end: number };

export function PendingEntryHighlight({ text, range, editor, revision }: {
  text: string;
  range: Range | null;
  editor: RefObject<HTMLTextAreaElement | null>;
  revision?: string;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const latest = useRef({ text, range, revision });
  latest.current = { text, range, revision };
  const scheduleRef = useRef<(() => void) | null>(null);

  // Text updates repaint on the next frame, keeping input handlers/layout free.
  useLayoutEffect(() => { scheduleRef.current?.(); }, [text, range?.start, range?.end, revision]);

  useLayoutEffect(() => {
    const textarea = editor.current;
    const layer = overlay.current;
    if (!textarea || !layer) return;

    let frame = 0;
    let disposed = false;
    let mirror: HTMLDivElement | null = null;
    let layoutDirty = true;
    let lastRevision = revision;
    let cachedStyle: Record<string, string> = {};

    const render = () => {
      frame = 0;
      if (disposed) return;
      const current = latest.current;
      if (current.revision !== lastRevision) { lastRevision = current.revision; layoutDirty = true; }
      if (!mirror) {
        mirror = document.createElement('div');
        mirror.className = 'pending-entry-highlight-mirror';
        mirror.setAttribute('aria-hidden', 'true');
        layer.replaceChildren(mirror);
      }
      if (layoutDirty) {
        const properties = [
          'box-sizing', 'width', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch',
          'font-variant', 'font-feature-settings', 'font-variation-settings', 'font-kerning', 'font-synthesis',
          'letter-spacing', 'line-height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
          'word-spacing', 'tab-size', 'text-indent', 'text-align', 'text-transform', 'text-rendering', 'direction',
          'unicode-bidi', 'writing-mode', 'text-orientation', 'white-space', 'overflow-wrap', 'word-break', 'line-break',
          'hyphens', '-webkit-text-size-adjust', 'border-top-width', 'border-right-width', 'border-bottom-width',
          'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
        ];
        const style = getComputedStyle(textarea);
        cachedStyle = Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)]));
        properties.forEach(property => mirror!.style.setProperty(property, cachedStyle[property]));
        layoutDirty = false;
      }
      const overlayBounds = layer.getBoundingClientRect();
      const textareaBounds = textarea.getBoundingClientRect();
      mirror.style.left = `${textareaBounds.left - overlayBounds.left}px`;
      mirror.style.top = `${textareaBounds.top - overlayBounds.top}px`;
      const horizontalBorder = (parseFloat(cachedStyle['border-left-width']) || 0) + (parseFloat(cachedStyle['border-right-width']) || 0);
      mirror.style.width = `${textarea.clientWidth + horizontalBorder}px`;
      mirror.style.height = `${textarea.offsetHeight}px`;
      mirror.style.boxSizing = 'border-box';
      mirror.style.paddingTop = cachedStyle['padding-top'] || '0';
      mirror.style.paddingRight = cachedStyle['padding-right'] || '0';
      mirror.style.paddingBottom = cachedStyle['padding-bottom'] || '0';
      mirror.style.paddingLeft = cachedStyle['padding-left'] || '0';
      mirror.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;

      const { text: currentText, range: currentRange } = current;
      const start = currentRange && Number.isInteger(currentRange.start) ? Math.max(0, Math.min(currentText.length, currentRange.start)) : -1;
      const end = currentRange && Number.isInteger(currentRange.end) ? Math.max(start, Math.min(currentText.length, currentRange.end)) : -1;
      const fragment = document.createDocumentFragment();
      const appendText = (value: string, highlighted = false) => {
        const span = document.createElement('span');
        if (highlighted) span.className = 'pending-entry-highlight-mark';
        span.textContent = value;
        fragment.appendChild(span);
      };
      if (start >= 0 && end > start) {
        appendText(currentText.slice(0, start));
        appendText(currentText.slice(start, end), true);
        appendText(currentText.slice(end));
      } else appendText(currentText);
      // A final newline otherwise has no final line box for caret-aligned layout.
      appendText('\u200b');
      mirror.replaceChildren(fragment);
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(render);
    };
    scheduleRef.current = schedule;

    render();
    const observer = new ResizeObserver(() => { layoutDirty = true; schedule(); });
    observer.observe(textarea);
    if (textarea.parentElement) observer.observe(textarea.parentElement);
    textarea.addEventListener('scroll', schedule, { passive: true });
    const layoutChanged = () => { layoutDirty = true; schedule(); };
    window.addEventListener('resize', layoutChanged);
    window.visualViewport?.addEventListener('resize', layoutChanged);
    document.fonts.addEventListener('loadingdone', layoutChanged);
    void document.fonts.ready.then(layoutChanged);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      scheduleRef.current = null;
      observer.disconnect();
      textarea.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', layoutChanged);
      window.visualViewport?.removeEventListener('resize', layoutChanged);
      document.fonts.removeEventListener('loadingdone', layoutChanged);
      layer.replaceChildren();
    };
  }, [editor]);

  return <div className="pending-entry-highlight-overlay" ref={overlay} aria-hidden="true" />;
}
