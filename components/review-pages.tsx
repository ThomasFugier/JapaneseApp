'use client';

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// CSS columns keep complete lines (including ruby) on each mobile page.
export function ReviewPages({ children, className, label, contentKey }: { children: ReactNode; className: string; label: string; contentKey: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState({ pages: 1, offset: 0 });
  const measure = useCallback(() => {
    const box = viewport.current, columns = flow.current, text = content.current;
    if (!box || !columns || !text || !box.clientWidth) return;
    const mobile = getComputedStyle(columns).columnCount === '1';
    const pages = mobile ? Math.max(1, Math.ceil((columns.scrollWidth - 1) / box.clientWidth)) : 1;
    const offset = mobile && pages === 1 ? Math.max(0, Math.floor((box.clientHeight - text.getBoundingClientRect().height) / 2)) : 0;
    setLayout(previous => previous.pages === pages && previous.offset === offset ? previous : { pages, offset });
    setPage(previous => Math.min(previous, pages - 1));
  }, []);

  useLayoutEffect(() => { measure(); }, [children, measure]);
  useLayoutEffect(() => { setPage(0); measure(); }, [contentKey, measure]);
  useLayoutEffect(() => {
    let active = true;
    const resized = new ResizeObserver(measure);
    if (viewport.current) resized.observe(viewport.current);
    const changed = new MutationObserver(measure);
    if (content.current) changed.observe(content.current, { childList: true, subtree: true, characterData: true });
    const fontChanged = () => { if (active) measure(); };
    void document.fonts.ready.then(fontChanged);
    document.fonts.addEventListener('loadingdone', fontChanged);
    return () => { active = false; resized.disconnect(); changed.disconnect(); document.fonts.removeEventListener('loadingdone', fontChanged); };
  }, [measure]);

  return <div className={`${className} review-pages`}>
    <div ref={viewport} className="review-pages-viewport">
      <div ref={flow} className="review-page-flow" style={{ transform: `translateX(${-page * 100}%)` }}>
        <div ref={content} className="review-page-content" style={{ position: 'relative', top: layout.offset }}>{children}</div>
      </div>
    </div>
    {layout.pages > 1 && <nav className="review-pagination" aria-label={`${label} pages`}>
      <button type="button" aria-label={`Previous ${label.toLowerCase()} page`} disabled={page === 0} onClick={() => setPage(previous => Math.max(0, previous - 1))}><ChevronLeft size={16} /></button>
      <span aria-live="polite" aria-atomic="true">{page + 1} / {layout.pages}</span>
      <button type="button" aria-label={`Next ${label.toLowerCase()} page`} disabled={page >= layout.pages - 1} onClick={() => setPage(previous => Math.min(layout.pages - 1, previous + 1))}><ChevronRight size={16} /></button>
    </nav>}
  </div>;
}
