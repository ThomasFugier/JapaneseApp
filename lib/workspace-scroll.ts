const MOBILE_MAX_WIDTH = 640;

function getScroller(): HTMLElement | null {
  if (typeof window === 'undefined') return null;
  if (window.innerWidth <= MOBILE_MAX_WIDTH && typeof document !== 'undefined') {
    return document.getElementById('main-content');
  }
  return null;
}

export function getWorkspaceScrollTop(): number {
  if (typeof window === 'undefined') return 0;
  const scroller = getScroller();
  return scroller ? scroller.scrollTop : window.scrollY;
}

export function scrollWorkspaceTo(top: number, behavior: ScrollBehavior = 'instant'): void {
  const scroller = getScroller();
  if (scroller) scroller.scrollTo({ top, behavior });
  else if (typeof window !== 'undefined') window.scrollTo({ top, behavior });
}

export function isWorkspaceScrollEvent(event: Event): boolean {
  const scroller = getScroller();
  if (scroller) return event.target === scroller;
  if (typeof window === 'undefined') return false;
  return event.target === window || event.target === document;
}
