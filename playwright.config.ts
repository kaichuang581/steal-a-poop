import { defineConfig } from '@playwright/test';

// Set PW_CHROMIUM to use an already-installed Chromium instead of Playwright's own download.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/steal-a-poop/',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/steal-a-poop/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
