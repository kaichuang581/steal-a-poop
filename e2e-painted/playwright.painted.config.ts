import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// The painted smoke and fault suite (docs/visual-overhaul/16-qa-and-acceptance.md, section 4.1 a): the one place a
// build machine opens the game players see. `npm run test:painted` runs it; so does the gate (tools/gate/smoke.mjs).
//
// It builds the default (painted) look itself and serves that build itself, so what is tested is this checkout as it
// stands and nothing left over: `npm run build`, then `vite preview` on port 4175. Set PAINTED_PORT to run a second
// copy of the tree beside it. The port is strict and a server already there is never reused: a suite that tested
// somebody else's build would be green for nothing.
const PORT = Number(process.env.PAINTED_PORT) || 4175;
const ADDRESS = `http://127.0.0.1:${PORT}/steal-a-poop/`;
/** The checkout this file is in. The build and the server run there, not in this folder (where a web server starts by default). */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  // A case waits for the page, never for a clock, but the page itself can be slow: building the farm freezes it for
  // seconds, and a shared machine draws in software. Each wait has its own patience (helpers.ts); this is the roof.
  timeout: 240_000,
  expect: { timeout: 20_000 },
  // A case that fails once has failed: no second try hides a page that only works some of the time.
  retries: 0,
  // And none may be run alone or left out by a stray mark.
  forbidOnly: true,
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { outputFolder: '../playwright-report', open: 'never' }]],
  use: {
    baseURL: ADDRESS,
    viewport: { width: 1280, height: 800 },
    // A click waits until its target can take it. Behind the loading doors that is as long as Home takes to build.
    actionTimeout: 120_000,
    navigationTimeout: 60_000,
    screenshot: 'only-on-failure',
    launchOptions: {
      // Software rendering, the same on a laptop and on a build machine with no graphics chip (tools/gate/lib/painted.mjs
      // uses the same three). The draw calls themselves are skipped by an init script: see helpers.ts.
      args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader'],
      // Set PW_CHROMIUM to use an already-installed Chromium instead of Playwright's own download.
      ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: ROOT,
    url: ADDRESS,
    reuseExistingServer: false,
    timeout: 600_000,
    // The build players get from a checkout with nothing set: no game server, no sign-in, the painted look, the usual
    // address. Whatever the shell or an env file holds for these is overridden, so the six-row menu is always the one
    // tested.
    env: { VITE_SERVER_URL: '', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_TURNSTILE_SITE_KEY: '', VITE_SKIN: '', VITE_BASE: '' },
  },
});
