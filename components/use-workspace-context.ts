'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultReadingContext, sanitizeReadingContext, updateReadingContext, type ReadingContext } from '@/lib/library-view';
import { isLessonId, type LessonId } from '@/lib/lessons';

export type WorkspaceTab = 'home' | 'review' | 'library' | 'lessons' | 'writing' | 'stats' | 'japan';
export type JapaneseFont = 'brush' | 'plain';
export type PageTheme = 'plain' | 'waves' | 'sakura' | 'maple';
const KEY = 'kotoba-workspace-v1';

export function useWorkspaceContext() {
  const [tab, setTabState] = useState<WorkspaceTab>('home');
  const [reading, setReadingState] = useState<ReadingContext>({ ...defaultReadingContext });
  const [japaneseFont, setJapaneseFontState] = useState<JapaneseFont>('brush');
  const [pageTheme, setPageThemeState] = useState<PageTheme>('waves');
  const [lessonId, setLessonIdState] = useState<LessonId | null>(null);
  const [furiganaEnabled, setFuriganaEnabledState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const readingRef = useRef(reading);
  const tabRef = useRef(tab);
  const japaneseFontRef = useRef(japaneseFont);
  const pageThemeRef = useRef(pageTheme);
  const lessonIdRef = useRef(lessonId);
  const furiganaRef = useRef(false);
  const loaded = useRef(false);
  const save = useCallback(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY, JSON.stringify({ tab: tabRef.current, reading: readingRef.current, japaneseFont: japaneseFontRef.current, pageTheme: pageThemeRef.current, lessonId: lessonIdRef.current, furiganaEnabled: furiganaRef.current })); } catch { /* Preferences are optional; library data lives in IndexedDB. */ }
  }, []);
  const setReading = useCallback((patch: Partial<ReadingContext>) => {
    const next = updateReadingContext(readingRef.current, patch);
    readingRef.current = next; setReadingState(next); save();
  }, [save]);
  const setJapaneseFont = useCallback((value: JapaneseFont) => {
    japaneseFontRef.current = value; setJapaneseFontState(value); save();
  }, [save]);
  const setFuriganaEnabled = useCallback((value: boolean) => {
    furiganaRef.current = value; setFuriganaEnabledState(value); save();
  }, [save]);
  const setPageTheme = useCallback((value: PageTheme) => {
    pageThemeRef.current = value; setPageThemeState(value); save();
  }, [save]);
  const setLessonId = useCallback((value: LessonId | null) => {
    lessonIdRef.current = value; setLessonIdState(value); save();
  }, [save]);
  const captureReadingScroll = useCallback(() => {
    if (tabRef.current !== 'library') return;
    readingRef.current = { ...readingRef.current, scrollY: window.scrollY };
    save();
  }, [save]);
  const setTab = useCallback((next: WorkspaceTab) => {
    if (tabRef.current !== next) captureReadingScroll(); tabRef.current = next; setTabState(next);
    // Keep the state used by LibraryView in step with the captured position.
    setReadingState(readingRef.current); save();
  }, [captureReadingScroll, save]);
  const restoreReadingScroll = useCallback(() => {
    const target = readingRef.current.scrollY;
    return requestAnimationFrame(() => window.scrollTo({ top: target, behavior: 'instant' }));
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && typeof saved === 'object') {
        const next = sanitizeReadingContext(saved.reading);
        const nextTab: WorkspaceTab = saved.tab === 'library' || saved.tab === 'review' || saved.tab === 'lessons' || saved.tab === 'writing' || saved.tab === 'stats' || saved.tab === 'japan' ? saved.tab : 'home';
        lessonIdRef.current = isLessonId(saved.lessonId) ? saved.lessonId : null; setLessonIdState(lessonIdRef.current);
        const nextFont: JapaneseFont = saved.japaneseFont === 'plain' ? 'plain' : 'brush';
        const nextTheme: PageTheme = saved.pageTheme === 'plain' || saved.pageTheme === 'sakura' || saved.pageTheme === 'maple' ? saved.pageTheme : 'waves';
        pageThemeRef.current = nextTheme; setPageThemeState(nextTheme);
        furiganaRef.current = saved.furiganaEnabled === true; setFuriganaEnabledState(furiganaRef.current);
        japaneseFontRef.current = nextFont; setJapaneseFontState(nextFont);
        readingRef.current = next; tabRef.current = nextTab; setReadingState(next); setTabState(nextTab);
      }
    } catch { /* A corrupt preference never blocks access to library data. */ }
    loaded.current = true; setHydrated(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(captureReadingScroll, 150); };
    const onHide = () => { if (document.visibilityState === 'hidden') captureReadingScroll(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', captureReadingScroll);
    document.addEventListener('visibilitychange', onHide);
    return () => { clearTimeout(timer); window.removeEventListener('scroll', onScroll); window.removeEventListener('pagehide', captureReadingScroll); document.removeEventListener('visibilitychange', onHide); };
  }, [captureReadingScroll]);

  return { tab, setTab, reading, setReading, japaneseFont, setJapaneseFont, pageTheme, setPageTheme, lessonId, setLessonId, furiganaEnabled, setFuriganaEnabled, hydrated, captureReadingScroll, restoreReadingScroll };
}
