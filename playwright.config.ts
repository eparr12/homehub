import { defineConfig, devices } from '@playwright/test';
import {
  TEST_LOGIN_HEADERS,
  TEST_SERVER_ORIGIN,
} from './tests/e2e/test-server.ts';

// A spec runs in every project unless its name ends in wall.spec.ts, which
// only the wall runs, or phone.spec.ts, which only the phones run. A new spec
// can't miss every project by being left out of a list.
const WALL_SPECS = /wall\.spec\.ts$/;
const PHONE_SPECS = /phone\.spec\.ts$/;

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
      testIgnore: PHONE_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        hasTouch: true,
      },
    },
    {
      name: 'iphone',
      testIgnore: WALL_SPECS,
      use: devices['iPhone 17'],
    },
    {
      name: 'android',
      testIgnore: WALL_SPECS,
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
