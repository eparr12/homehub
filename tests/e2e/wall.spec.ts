import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  findSmallTargets,
  findViolations,
  readOverflow,
} from './page-checks.ts';

// The wall's touch target (WEB-7).
const WALL_TARGET_PX = 64;

test.beforeEach(async ({ page }) => {
  await page.goto('/wall');
  await expect(page.getByRole('region', { name: 'Status' })).toBeVisible();
});

test('reports the server and its database OK in the status tile', async ({
  page,
}) => {
  const statusCard = page.getByRole('region', { name: 'Status' });

  await expect(statusCard.getByRole('status')).toContainText([
    'Server and database OK',
  ]);
});

test('fills 1920 by 1080 without scrolling', async ({ page }) => {
  expect(await readOverflow(page)).toEqual({ x: 0, y: 0 });
});

test('opens the Photos card as a dialog, and Close gives focus back', async ({
  page,
}) => {
  const photosCard = page.getByRole('button', { name: 'Photos' });
  const dialog = page.getByRole('dialog', { name: 'Photos' });

  await photosCard.tap();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).tap();

  await expect(dialog).toBeHidden();
  await expect(photosCard).toBeFocused();
});

test('gives the card buttons and Close 64 px touch targets', async ({
  page,
}) => {
  const cards = await findSmallTargets(
    {
      Photos: page.getByRole('button', { name: 'Photos' }),
      Countdown: page.getByRole('button', { name: 'Countdown' }),
      Groceries: page.getByRole('button', { name: 'Groceries' }),
    },
    WALL_TARGET_PX,
  );
  const dialog = await openPhotos(page);
  const close = await findSmallTargets(
    { Close: dialog.getByRole('button', { name: 'Close' }) },
    WALL_TARGET_PX,
  );

  expect([...cards, ...close]).toEqual([]);
});

test('passes axe', async ({ page }) => {
  expect(await findViolations(page)).toEqual([]);
});

test('passes axe with a card open', async ({ page }) => {
  await openPhotos(page);

  expect(await findViolations(page)).toEqual([]);
});

/**
 * Opens the Photos card and waits for its open animation to end, when the
 * view covers the screen. Until then it's scaled down from 0.96 (WEB-8), and
 * so is everything in it.
 */
async function openPhotos(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog', { name: 'Photos' });
  await page.getByRole('button', { name: 'Photos' }).tap();
  await expect
    .poll(() => dialog.boundingBox())
    .toEqual({ x: 0, y: 0, ...page.viewportSize() });
  return dialog;
}
