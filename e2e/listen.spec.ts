import { expect, test, type Page } from '@playwright/test';

import { connectVirtualKeyboard } from './virtualKeyboard';

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

  await listen.click();
  await expect(listen).toHaveText('Stop');

  // m1 b1's C3-G3-G4, and nothing asked for while it sounds.
  await pollHeldPitches(page).toEqual([48, 55, 67]);
  await expect(page.locator('[data-expected="true"]')).toHaveCount(0);

  // m1 b4: G4 alone, 1363 ms in.
  await pollHeldPitches(page).toEqual([67]);

  await listen.click();

  // Back to the engine: nothing sounding, m1 b1's three keys asked for again, and the
  // demo has left no mark on where practice had got to.
  await expect(listen).toHaveText('Listen');
  await pollHeldPitches(page).toEqual([]);
  await expect(page.locator('[data-expected="true"]')).toHaveCount(3);
  await expect(readout).toHaveText(position ?? '');
});
