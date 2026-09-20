import { expect, test, type Locator, type Page } from '@playwright/test';

import { connectVirtualKeyboard } from './virtualKeyboard';

/** Where OSMD has put the cursor, read as e2e/staff-cursor.spec.ts reads it. */
function cursorPosition(cursor: Locator) {
  return cursor.evaluate((el) => `${el.style.left} ${el.style.top}`);
}

/** Every pitch the keyboard is showing as sounding, lowest first. */
function heldPitches(page: Page) {
  return page
    .locator('[data-held="true"]')
    .evaluateAll((keys) =>
      keys.map((key) => Number(key.getAttribute('data-note'))).sort((a, b) => a - b),
    );
}

/** Polled at 50 ms: at 66 bpm a step of the demo can be as short as 455 ms. */
const pollHeldPitches = (page: Page) =>
  expect.poll(() => heldPitches(page), { intervals: [50] });

// The highlighting half only. Whether the instrument makes a sound is item 9 in
// MANUAL-CHECKS.md: the container never talks to the piano.
test('Listen lights the keys through the opening bars, leaving practice where it was', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);

  const readout = page.getByTestId('position-readout');
  const position = await readout.textContent();
  const listen = page.getByTestId('listen-to-piece');
  const cursor = page.getByTestId('staff').locator('img');
  await expect(cursor).toBeVisible();
  // Where practice is waiting, which the demo must both leave and come back to.
  const practiceMark = await cursorPosition(cursor);

  await listen.click();
  await expect(listen).toHaveText('Stop');

  // m1 b1's G4, and nothing asked for while it sounds.
  await pollHeldPitches(page).toEqual([67]);
  await expect(page.locator('[data-expected="true"]')).toHaveCount(0);

  // m1 b2.5: A4, 1364 ms in.
  await pollHeldPitches(page).toEqual([69]);

  // The cursor has followed the demo off the note practice is still waiting for.
  // Which note it has reached is item 11 in MANUAL-CHECKS.md, read against the music.
  await expect.poll(() => cursorPosition(cursor)).not.toBe(practiceMark);

  await listen.click();

  // Back to the engine: nothing sounding, m1 b1's G4 asked for again, and the demo has
  // left no mark on where practice had got to.
  await expect(listen).toHaveText('Listen');
  await pollHeldPitches(page).toEqual([]);
  await expect(page.locator('[data-expected="true"]')).toHaveCount(1);
  await expect(readout).toHaveText(position ?? '');
  await expect.poll(() => cursorPosition(cursor)).toBe(practiceMark);
});
