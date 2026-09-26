import { expect, test } from '@playwright/test';

// jsdom cannot draw notation, so this is the only layer that sees the real OSMD. Whether
// the notation is *correct* is item 11 in MANUAL-CHECKS.md — nothing automated reads music.
test('the staff draws the piece', async ({ page }) => {
  await page.goto('/');

  const staff = page.getByTestId('staff');
  await expect(staff.locator('svg')).toBeVisible();

  // OSMD tags each staff line group `staffline`, which is its own class. VexFlow's
  // `vf-`-prefixed ones are a private API and would move under a version bump.
  // One per hand: the piece is a single system, not several stacked ones.
  await expect(staff.locator('.staffline')).toHaveCount(2);

  // The pane scrolls sideways through the piece, and none of the staff is cut off below.
  const size = await staff.evaluate((el) => ({
    overflowsSideways: el.scrollWidth > el.clientWidth,
    overflowsDownwards: el.scrollHeight > el.clientHeight,
  }));
  expect(size).toEqual({ overflowsSideways: true, overflowsDownwards: false });
});
