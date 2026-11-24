import { expect, test } from './fixtures.ts';
import { TEST_SHORT_NAME } from './test-server.ts';

test("answers /api/me with the test login's short name", async ({ page }) => {
  const response = await page.request.get('/api/me');
  const body: unknown = await response.json();

  expect(response.status()).toBe(200);
  // Compared raw, so a leaked login or any other extra field fails.
  expect(body).toEqual({
    shortName: TEST_SHORT_NAME,
    displayName: TEST_SHORT_NAME,
  });
});

test('answers 401 to a request without a Tailscale login', async ({
  playwright,
}) => {
  // A new request context takes the config's options, extraHTTPHeaders
  // among them, unless it names its own.
  const anonymous = await playwright.request.newContext({
    extraHTTPHeaders: {},
  });
  try {
    const response = await anonymous.get('/api/me');

    expect(response.status()).toBe(401);
  } finally {
    await anonymous.dispose();
  }
});

test('shows "Page not found" for a path with no view', async ({ page }) => {
  // Not /api: the match is per segment, so this path is the app's.
  await page.goto('/apiary');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Page not found' }),
  ).toBeVisible();
});
