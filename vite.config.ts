import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
    "style-src 'self' 'unsafe-inline'", // the interface sets many inline style attributes
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

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves this repo at /steal-a-poop/
  base: '/steal-a-poop/',
  plugins: [react(), tailwindcss(), csp(mode)],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
  },
}));
