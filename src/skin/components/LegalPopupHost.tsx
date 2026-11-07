import { Suspense, lazy, useEffect, useState } from 'react';
import { isLegalSlug } from '../../ui/legal/legalLinks';
import type { LegalSlug } from '../../ui/legal/legalLinks';

const LegalDialog = lazy(() => import('./LegalDialog').then((m) => ({ default: m.LegalDialog })));

/** The slug in a link to a legal page (…#/legal/privacy), or null for any other link. */
export function legalSlugOf(href: string | null | undefined): LegalSlug | null {
  const m = href?.match(/#\/legal\/([a-z-]+)$/);
  return m && isLegalSlug(m[1]) ? m[1] : null;
}

/** Makes every link to a legal page open as a window over whatever is on screen, so nobody leaves the game. Renders nothing until one is clicked. */
export function LegalPopupHost() {
  const [slug, setSlug] = useState<LegalSlug | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // "open in a new tab" still works
      const a = (e.target as Element | null)?.closest?.('a');
      const s = legalSlugOf(a?.getAttribute('href'));
      if (!s) return;
      e.preventDefault();
      setSlug(s);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  if (!slug) return null;
  return <Suspense fallback={null}><LegalDialog initial={slug} onClose={() => setSlug(null)} /></Suspense>;
}
