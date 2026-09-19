import { expect, test, type Page } from '@playwright/test';

import { connectVirtualKeyboard, playChord } from './virtualKeyboard';

/** Every pitch the keyboard currently marks as expected, lowest first. */
function expectedPitches(page: Page) {
  return page
    .locator('[data-expected="true"]')
    .evaluateAll((keys) =>
      keys.map((key) => Number(key.getAttribute('data-note'))).sort((a, b) => a - b),
    );
}

test('the keyboard marks the keys the engine waits for, and moves on once they are played', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);

  // m1 b1 is a C3-G3-G4 chord, and nothing else on the keyboard is marked.
  await expect.poll(() => expectedPitches(page)).toEqual([48, 55, 67]);

  const keyC3 = page.locator('[data-note="48"]');
  await page.keyboard.down('z'); // C3, the lowest of the three

  await expect(keyC3).toHaveAttribute('data-held', 'true');
  await expect(keyC3).toHaveAttribute('data-expected', 'true');

  await playChord(page, [55, 67]); // completes the chord, with C3 still sustaining

  // m1 b4: G4 alone. C3 is still held, and no longer expected.
  await expect.poll(() => expectedPitches(page)).toEqual([67]);
  await expect(keyC3).toHaveAttribute('data-held', 'true');
  await expect(keyC3).toHaveAttribute('data-expected', 'false');
});
