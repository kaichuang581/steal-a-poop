import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '../../auth/config';

interface Turnstile {
  render(el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void; 'error-callback': () => void }): string;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('captcha script failed'));
    document.head.appendChild(s);
  });
  return loading;
}

/** True when the bot check can run in this build: a site key is set, or it is a development build. */
export const captchaAvailable = () => !!TURNSTILE_SITE_KEY || import.meta.env.DEV;

/**
 * The bot check. It reports a one-time token through `onToken` (null when it expires). The server confirms the
 * token with Cloudflare, and Supabase confirms it for its own sign-up and password-reset pages.
 * In a development build without a site key it supplies "dev-ok", which only the development server accepts.
 */
export function Captcha({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      if (import.meta.env.DEV) onToken('dev-ok');
      return;
    }
    let id: string | null = null;
    let gone = false;
    loadScript()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t) => onToken(t),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      gone = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY && !import.meta.env.DEV) {
    return <p role="alert" className="rounded-lg bg-red-900/40 p-2 text-sm">The bot check is not set up for this site, so sign-up is switched off.</p>;
  }
  return <div ref={box} data-testid="captcha" className="min-h-[65px]" />;
}
