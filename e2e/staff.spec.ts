import { expect, test } from '@playwright/test';

/**
 * The staff's real check: jsdom cannot draw notation (see src/testSetup.ts), so this is
 * the layer that proves anything was rendered at all. That what it renders is the *right*
 * notation is item 11 in MANUAL-CHECKS.md — nothing automated can read music.
 */
test('the staff draws the piece', async ({ page }) => {
  await page.goto('/');

  const staff = page.getByTestId('staff');
  await expect(staff.locator('svg')).toBeVisible();

  // OSMD tags each staff line group `staffline`, which is its own class. VexFlow's
  // `vf-`-prefixed ones are a private API and would move under a version bump.
  await expect.poll(() => staff.locator('.staffline').count()).toBeGreaterThan(1);

  await expect(staff.getByText('Cicha Noc')).toBeVisible();
});
