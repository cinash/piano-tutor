import { expect, test, type Page } from '@playwright/test';

import { connectVirtualKeyboard } from './virtualKeyboard';

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

  // m1 b1 is G4 alone, and nothing else on the keyboard is marked.
  await expect.poll(() => expectedPitches(page)).toEqual([67]);

  const keyG4 = page.locator('[data-note="67"]');
  await page.keyboard.down('t'); // G4 completes m1 b1, and is left sustaining

  // m1 b2.5: A4. G4 is still held, and no longer expected.
  await expect.poll(() => expectedPitches(page)).toEqual([69]);
  await expect(keyG4).toHaveAttribute('data-held', 'true');
  await expect(keyG4).toHaveAttribute('data-expected', 'false');
});
