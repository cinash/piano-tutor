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
test('the cursor moves when a chord is played, and returns to the start on Restart', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);

  const cursor = page.getByTestId('staff').locator('img');
  await expect(cursor).toBeVisible();
  const start = await cursorPosition(cursor);

  await playChord(page, [67, 48, 55]); // m1 b1: the opening C3-G3-G4 chord

  await expect.poll(() => cursorPosition(cursor)).not.toBe(start);

  await page.getByTestId('restart-practice').click();

  await expect.poll(() => cursorPosition(cursor)).toBe(start);
});
