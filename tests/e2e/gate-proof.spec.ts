import { expect, test } from './fixtures.ts';

// Fails on purpose: its pull request proves that a failing end-to-end test
// blocks the merge (build-plan step 1.7), and never merges.
test('blocks a pull request whose end-to-end test fails', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'A heading that does not exist' }),
  ).toBeVisible();
});
