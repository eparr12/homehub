import { defineConfig, devices } from '@playwright/test';
import {
  TEST_LOGIN_HEADERS,
  TEST_SERVER_ORIGIN,
} from './tests/e2e/test-server.ts';

// Run by every project, on top of each layout's own spec file.
const EVERY_PROJECT = ['app.spec.ts', 'service-worker.spec.ts'];

export default defineConfig({
  testDir: 'tests/e2e',
  // Every test gets its own browser context, so any two can run at once
  // (TEST-8).
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // A flaky test is fixed or quarantined, never retried until it passes
  // (TEST-9).
  retries: 0,
  // The HTML report never opens by itself, so `npm run e2e` always ends.
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: TEST_SERVER_ORIGIN,
    extraHTTPHeaders: TEST_LOGIN_HEADERS,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'wall',
      testMatch: ['wall.spec.ts', ...EVERY_PROJECT],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        hasTouch: true,
      },
    },
    {
      name: 'iphone',
      testMatch: ['phone.spec.ts', ...EVERY_PROJECT],
      use: devices['iPhone 17'],
    },
    {
      name: 'android',
      testMatch: ['phone.spec.ts', ...EVERY_PROJECT],
      use: devices['Pixel 10'],
    },
  ],
  webServer: {
    command: 'npm run build && node tests/e2e/start-server.ts',
    url: `${TEST_SERVER_ORIGIN}/api/health`,
    // Never another server: whatever holds the port runs with its own
    // database. A taken port stops the run with "is already used".
    reuseExistingServer: false,
  },
});
