import { expect, test, type Page } from '@playwright/test';

import {
  connectVirtualKeyboard,
  playOpeningMeasure,
  playSecondMeasure,
  selectLoopRange,
} from './virtualKeyboard';

/** The keys a hand's position is shaded on, lowest first, each with its finger. */
function positionOf(page: Page, hand: 'left' | 'right') {
  return page
    .locator(`[data-position-hand="${hand}"]`)
    .evaluateAll((keys) =>
      keys.map((key) => [
        Number(key.getAttribute('data-note')),
        key.getAttribute('data-finger'),
      ]),
    );
}

const E4_TO_B4 = [
  [64, '1'],
  [65, '2'],
  [67, '3'],
  [69, '4'],
  [71, '5'],
];

test('the right hand moves up to B4-F5 once bar 2 is played', async ({ page }) => {
  await connectVirtualKeyboard(page);
  await expect.poll(() => positionOf(page, 'right')).toEqual(E4_TO_B4);

  await playOpeningMeasure(page);
  await expect.poll(() => positionOf(page, 'right')).toEqual(E4_TO_B4);

  await playSecondMeasure(page); // E4, the last note before bar 5's D5
  await expect
    .poll(() => positionOf(page, 'right'))
    .toEqual([
      [71, '1'],
      [72, '2'],
      [74, '3'],
      [76, '4'],
      [77, '5'],
    ]);
});

test('a loop the left hand does not play in shows no left-hand position', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);
  await expect.poll(() => positionOf(page, 'left')).not.toEqual([]);

  await selectLoopRange(page, 1, 2);

  await expect.poll(() => positionOf(page, 'left')).toEqual([]);
});

test('the next position is outlined on the last note before the move', async ({
  page,
}) => {
  const outlined = () =>
    page
      .locator('[data-next-hand="right"]')
      .evaluateAll((keys) => keys.map((key) => Number(key.getAttribute('data-note'))));
  const keyB4 = page.locator('[data-note="71"]');

  await connectVirtualKeyboard(page);
  await playOpeningMeasure(page);

  // E4 is next, the last note on E4-B4: B4-F5 is outlined, and B4 is in both.
  await expect.poll(outlined).toEqual([71, 72, 74, 76, 77]);
  await expect(keyB4).toHaveAttribute('data-finger', '5');
  await expect(keyB4).toHaveAttribute('data-next-finger', '1');

  await playSecondMeasure(page);

  await expect.poll(outlined).toEqual([]);
  await expect(keyB4).toHaveAttribute('data-finger', '1');
});
