import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  findSmallTargets,
  findViolations,
  readOverflow,
} from './page-checks.ts';

// The phone's touch target (WEB-7).
const PHONE_TARGET_PX = 48;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(views(page)).toBeVisible();
});

test('lists the three views, with Groceries as the current one', async ({
  page,
}) => {
  await expect(views(page).getByRole('link')).toHaveText([
    'Groceries',
    'Photos',
    'Holidays',
  ]);
  await expect(
    views(page).getByRole('link', { name: 'Groceries' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('shows the Photos view when its link is tapped', async ({ page }) => {
  await views(page).getByRole('link', { name: 'Photos' }).tap();

  await expect(page).toHaveURL('/photos');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Photos' }),
  ).toBeVisible();
});

test('gives the view links and the Wall link 48 px touch targets', async ({
  page,
}) => {
  const small = await findSmallTargets(
    {
      Groceries: views(page).getByRole('link', { name: 'Groceries' }),
      Photos: views(page).getByRole('link', { name: 'Photos' }),
      Holidays: views(page).getByRole('link', { name: 'Holidays' }),
      Wall: page.getByRole('link', { name: 'Wall' }),
    },
    PHONE_TARGET_PX,
  );

  expect(small).toEqual([]);
});

test('never scrolls sideways', async ({ page }) => {
  expect((await readOverflow(page)).x).toBe(0);
});

test('passes axe', async ({ page }) => {
  expect(await findViolations(page)).toEqual([]);
});

function views(page: Page) {
  return page.getByRole('navigation', { name: 'Views' });
}
