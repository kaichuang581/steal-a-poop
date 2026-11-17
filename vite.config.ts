import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// With its extension: Vite's own loader for this file, and Node's, resolve it only that way.
import { bootDoorsCss, bootDoorsMarkup } from './src/skin/loading/bootDoors.ts';

/**
 * Adds a Content-Security-Policy to the BUILT page (not the dev server, which needs inline scripts). It limits where the page may load
 * scripts from and where it may send data: itself, the game server, Supabase, and Cloudflare's bot check. A script injected into the page
 * could still run inside those limits but could not send anything to a stranger's server.
 * GitHub Pages cannot set headers, so this is a <meta> tag; it cannot express frame-ancestors, which needs a real header.
 */
export function contentSecurityPolicy(env: Record<string, string | undefined>): string {
  const origin = (u?: string) => {
    try {
      return u ? new URL(u).origin : '';
    } catch {
      return '';
    }
  };
  const server = env.VITE_SERVER_URL ? new URL(env.VITE_SERVER_URL.replace(/^ws/, 'http')) : null;
  const connect = [
    "'self'",
    origin(env.VITE_SUPABASE_URL),
    server ? server.origin : '',
    server ? server.origin.replace(/^http/, 'ws') : '',
  ].filter(Boolean);
  const turnstile = env.VITE_TURNSTILE_SITE_KEY ? ['https://challenges.cloudflare.com'] : [];
  return [
    "default-src 'self'",
    `script-src 'self' ${turnstile.join(' ')}`.trim(),
    `connect-src ${connect.join(' ')}`,
    // The interface sets many inline style attributes. The fonts ship with the game (public/fonts), so no other site is named.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self'",
    `frame-src ${turnstile.join(' ') || "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

const csp = (mode: string): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml(html) {
    const policy = contentSecurityPolicy(loadEnv(mode, process.cwd(), 'VITE_'));
    return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
});

// GitHub Pages serves this repo at /steal-a-poop/ by default. The deploy builds the root copy for fleeced.io with VITE_BASE=/.
const BASE = process.env.VITE_BASE || '/steal-a-poop/';
const DOORS_SLOT = '<!--boot-doors-->';
/**
 * Writes the loading screen's barn doors into the page itself, shut: their element where index.html marks the place, and
 * in the head the few rules of skin.css that draw them. The game's code is a few megabytes and the doors are part of it,
 * so until it had all arrived the page was blank. Written in, the doors show with the first frame, and BarnDoors takes
 * over from them when it arrives. Plain markup and a style block only: the built page's policy (above) allows no inline script.
 */
export function withBootDoors(html: string, skinCss: string = readFileSync('src/skin/styles/skin.css', 'utf8'), base: string = BASE): string {
  if (!html.includes(DOORS_SLOT) || !html.includes('</head>')) throw new Error(`index.html has lost ${DOORS_SLOT} or its head: the barn doors have nowhere to go`);
  return html.replace(DOORS_SLOT, bootDoorsMarkup(base)).replace('</head>', `  <style id="boot-doors-style">${bootDoorsCss(skinCss)}</style>\n  </head>`);
}
const bootDoors = (): Plugin => ({ name: 'boot-doors', transformIndexHtml: (html) => withBootDoors(html) });

export default defineConfig(({ mode }) => ({
  base: BASE,
  plugins: [react(), tailwindcss(), csp(mode), bootDoors()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
  },
}));
