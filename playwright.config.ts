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
  // Scan both the committed perf suite under `e2e/` AND the gitignored
  // local-only suites under `tests/e2e/`. testDir defaults to cwd; testMatch
  // accepts a glob across multiple roots.
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.spec.ts'],
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
