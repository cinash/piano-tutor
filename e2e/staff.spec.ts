import { expect, test } from '@playwright/test';

// jsdom cannot draw notation, so this is the only layer that sees the real OSMD. Whether
// the notation is *correct* is item 11 in MANUAL-CHECKS.md — nothing automated reads music.
test('the staff draws the piece', async ({ page }) => {
  await page.goto('/');

  const staff = page.getByTestId('staff');
  await expect(staff.locator('svg')).toBeVisible();

  // OSMD tags each staff line group `staffline`, which is its own class. VexFlow's
  // `vf-`-prefixed ones are a private API and would move under a version bump.
  expect(await staff.locator('.staffline').count()).toBeGreaterThan(1);

  await expect(staff.getByText('Cicha Noc')).toBeVisible();
});
