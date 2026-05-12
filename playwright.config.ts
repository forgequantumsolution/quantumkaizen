import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the perf-verification suite.
 *
 * The suite assumes the dev servers are already running:
 *   - Frontend on http://localhost:3000
 *   - Backend  on http://localhost:4000
 *
 * It does NOT spin up its own webServer because the project's dev servers
 * are typically left running in separate terminals.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // perf assertions are wall-clock; parallelism distorts them
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
