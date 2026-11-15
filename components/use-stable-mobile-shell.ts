'use client';

import { useLayoutEffect, type RefObject } from 'react';
import './stable-mobile-shell.css';

// Keep ordinary page scrolling away from the browser's collapsing toolbar.
// Only the keyboard changes the frame; browser-toolbar resize keeps 100svh.
export function useStableMobileShell(shellRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!enabled || !shell) return;
    const root = document.documentElement;
    const mobile = window.matchMedia('(max-width: 640px)');
    const main = document.getElementById('main-content');
    const navigation = shell.querySelector<HTMLElement>('.mobile-nav');
    let frame = 0;

    const syncKeyboard = () => {
      if (!mobile.matches) return;
      const focused = document.activeElement;
      const editable = focused instanceof HTMLElement && (focused.matches('input,textarea,select') || focused.isContentEditable);
      const viewport = window.visualViewport;
      const keyboard = editable && !!viewport && viewport.height < window.innerHeight - 120;
      shell.toggleAttribute('data-mobile-keyboard', keyboard);
      if (keyboard && viewport) {
        shell.style.setProperty('--mobile-shell-height', `${viewport.height}px`);
        shell.style.setProperty('--mobile-shell-top', `${viewport.offsetTop}px`);
      } else {
        shell.style.removeProperty('--mobile-shell-height');
        shell.style.removeProperty('--mobile-shell-top');
      }
      shell.style.setProperty('--mobile-shell-nav-space', `${navigation?.getBoundingClientRect().height ?? 0}px`);
    };

    const syncMode = () => {
      const previousMobile = root.classList.contains('stable-mobile-shell');
      const top = previousMobile ? main?.scrollTop ?? 0 : window.scrollY;
      root.classList.toggle('stable-mobile-shell', mobile.matches);
      if (!mobile.matches) {
        shell.removeAttribute('data-mobile-keyboard');
        shell.style.removeProperty('--mobile-shell-height');
        shell.style.removeProperty('--mobile-shell-top');
        shell.style.removeProperty('--mobile-shell-nav-space');
      } else syncKeyboard();
      if (previousMobile !== mobile.matches) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (mobile.matches && main) main.scrollTo({ top, behavior: 'instant' });
          else window.scrollTo({ top, behavior: 'instant' });
        });
      }
    };

    syncMode();
    const observer = new ResizeObserver(syncKeyboard);
    if (navigation) observer.observe(navigation);
    mobile.addEventListener('change', syncMode);
    window.addEventListener('resize', syncKeyboard);
    window.visualViewport?.addEventListener('resize', syncKeyboard);
    window.visualViewport?.addEventListener('scroll', syncKeyboard);
    document.addEventListener('focusin', syncKeyboard);
    document.addEventListener('focusout', syncKeyboard);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      mobile.removeEventListener('change', syncMode);
      window.removeEventListener('resize', syncKeyboard);
      window.visualViewport?.removeEventListener('resize', syncKeyboard);
      window.visualViewport?.removeEventListener('scroll', syncKeyboard);
      document.removeEventListener('focusin', syncKeyboard);
      document.removeEventListener('focusout', syncKeyboard);
      root.classList.remove('stable-mobile-shell');
      shell.removeAttribute('data-mobile-keyboard');
      for (const property of ['--mobile-shell-height', '--mobile-shell-top', '--mobile-shell-nav-space']) shell.style.removeProperty(property);
    };
  }, [enabled, shellRef]);
}
