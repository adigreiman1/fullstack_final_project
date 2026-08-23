import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Loaded explicitly because Playwright's config runs outside of Next.js's own
// env loading (@next/env), so .env.local is otherwise invisible to
// process.env here — that's where E2E_DISPATCHER_EMAIL/PASSWORD live.
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

/**
 * E2E tests run against a real Next.js server (Server Actions can't be hit
 * through a mocked fetch layer), so this always points at a running app
 * rather than an in-process render.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Reuses a server the developer already has running with `npm run dev`;
  // otherwise starts one so `npm run test:e2e` works standalone.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
