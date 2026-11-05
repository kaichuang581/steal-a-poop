import { defineConfig } from '@playwright/test';

const SERVER_PORT = 8788;

// Set PW_CHROMIUM to use an already-installed Chromium instead of Playwright's own download.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0, // one retry on the build server only, so a rare timing hiccup does not block a release
  reporter: 'list',
  expect: { timeout: 10_000 },
  use: {
    actionTimeout: 15_000,
    baseURL: 'http://127.0.0.1:4173/steal-a-poop/',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: [
    {
      // The multiplayer server, with its development sign-in. Tests only. "Mona" is the test moderator,
      // and the preview app's origin may call the HTTP API.
      command: `ALLOW_DEV_AUTH=1 DEV_MODERATORS=Mona ALLOWED_ORIGINS=http://127.0.0.1:4173,http://127.0.0.1:4174 PORT=${SERVER_PORT} npm run server`,
      port: SERVER_PORT,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // The app, built to talk to that server.
      command: `VITE_SKIN=classic VITE_SERVER_URL=ws://127.0.0.1:${SERVER_PORT} npm run build && npx vite preview --port 4173 --host 127.0.0.1`,
      url: 'http://127.0.0.1:4173/steal-a-poop/',
      reuseExistingServer: true,
      timeout: 180_000,
    },
      {
      // The same app built with real sign-in switched on, pointed at addresses the tests fake in the browser
      // (nothing real is contacted). Tests only.
      command: `VITE_SKIN=classic VITE_SERVER_URL=ws://127.0.0.1:${SERVER_PORT} VITE_SUPABASE_URL=http://127.0.0.1:8790 VITE_SUPABASE_ANON_KEY=sb_publishable_test VITE_TURNSTILE_SITE_KEY=test-site-key npx vite build --outDir dist-auth && npx vite preview --outDir dist-auth --port 4174 --host 127.0.0.1`,
      url: 'http://127.0.0.1:4174/steal-a-poop/',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
