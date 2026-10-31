import { useEffect, useState } from 'react';
import { useStore } from '../state/store';

/** One requestAnimationFrame loop drives all game timing from performance.now() timestamps. */
export function useGameLoop() {
  useEffect(() => {
    let id = 0;
    const loop = () => {
      useStore.getState().frame(performance.now());
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

/** Mirrors the visual viewport into CSS vars so the layout shrinks above the on-screen keyboard. */
export function useViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty('--vvh', `${vv?.height ?? window.innerHeight}px`);
      root.style.setProperty('--vvtop', `${vv?.offsetTop ?? 0}px`);
      if (vv && vv.offsetTop > 0) window.scrollTo(0, 0);
    };
    apply();
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
    };
  }, []);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 639px)');
