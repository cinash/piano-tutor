import { expect, test, type Locator } from '@playwright/test';

import { connectVirtualKeyboard, playChord } from './virtualKeyboard';

/**
 * OSMD positions the cursor by setting `top` and `left` on its own <img>, the only one
 * inside the staff. Reading the inline style rather than a bounding box keeps the
 * comparison independent of how far the pane happens to be scrolled.
 */
function cursorPosition(cursor: Locator) {
  return cursor.evaluate((el) => `${el.style.left} ${el.style.top}`);
}

// Movement and reset, not absolute position: whether the marker sits on the right note,
// and stays on it over a run of bars, is item 11 in MANUAL-CHECKS.md.
test('the cursor moves when a note is played, and returns to the start on Restart', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);

  const cursor = page.getByTestId('staff').locator('img');
  await expect(cursor).toBeVisible();
  const start = await cursorPosition(cursor);

  await playChord(page, [67]); // m1 b1: the opening G4

  await expect.poll(() => cursorPosition(cursor)).not.toBe(start);

  await page.getByTestId('restart-practice').click();

  await expect.poll(() => cursorPosition(cursor)).toBe(start);
});

// The piece is one system far wider than the window, so a mark past the pane's right edge
// has to bring the pane with it. The demo is the quickest way to move the mark there, and
// its setTimeout clock can be run forward rather than waited out.
test('the staff scrolls sideways to keep the cursor in view', async ({ page }) => {
  await page.clock.install();
  await connectVirtualKeyboard(page);

  const staff = page.getByTestId('staff');
  const cursor = staff.locator('img');
  await expect(cursor).toBeVisible();

  await page.getByTestId('listen-to-piece').click();
  await page.clock.runFor(40_000); // some fifteen bars at 66 bpm

  await expect.poll(() => staff.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(cursor).toBeInViewport();
});
