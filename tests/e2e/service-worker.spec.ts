import type { Page, Response } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { TEST_SERVER_ORIGIN } from './test-server.ts';

const HEALTH_URL = RegExp.escape(`${TEST_SERVER_ORIGIN}/api/health`);
// Offline, only the status tile's request for /api/health may fail, in
// whichever words the browser uses: Chromium says
// net::ERR_INTERNET_DISCONNECTED, and WebKit "WebKit encountered an internal
// error". Any other resource that fails, such as one missing from the
// precache, fails the test.
const HEALTH_UNREACHABLE = new RegExp(
  `^console error at ${HEALTH_URL}: Failed to load resource: `,
);
// WebKit shows a JSON response in a <pre> of its own with a style attribute,
// which the server's Content Security Policy blocks. Chromium's JSON view
// has none. Neither problem comes from the app.
const WEBKIT_JSON_VIEW_PROBLEMS = [
  /^policy violation: style-src-attr blocked inline$/,
  new RegExp(
    `^console error at ${HEALTH_URL}: Refused to apply a stylesheet because `,
  ),
];

test.beforeEach(async ({ page }) => {
  // One visit installs the worker, which precaches the app shell. It doesn't
  // claim this first page, so the next navigation is the first it answers.
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
});

test('serves a reload from the worker, with the security policy', async ({
  page,
}) => {
  const response = answered(await page.reload());

  expect(response.fromServiceWorker()).toBe(true);
  // The precached index.html keeps the headers the server sent with it (SEC-8).
  expect(await response.headerValue('Content-Security-Policy')).toContain(
    "default-src 'self'",
  );
});

test('leaves a navigation to /api/health to the server', async ({
  page,
  browserName,
  expectProblem,
}) => {
  if (browserName === 'webkit') {
    for (const problem of WEBKIT_JSON_VIEW_PROBLEMS) expectProblem(problem);
  }

  const response = answered(await page.goto('/api/health'));

  expect(response.fromServiceWorker()).toBe(false);
});

test('loads the app offline after one visit', async ({
  page,
  context,
  expectProblem,
}) => {
  expectProblem(HEALTH_UNREACHABLE);

  await context.setOffline(true);
  await page.reload();
  await expect(views(page)).toBeVisible();
  await page.goto('/wall');

  await expect(
    page.getByRole('region', { name: 'Status' }).getByRole('status'),
  ).toContainText(["Can't reach the server", 'Offline']);
});

/** A navigation's response, which only about:blank or a hash change lacks. */
function answered(response: Response | null): Response {
  if (response === null) throw new Error('The navigation got no response');
  return response;
}

function views(page: Page) {
  return page.getByRole('navigation', { name: 'Views' });
}
