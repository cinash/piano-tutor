import { expect, test } from '@playwright/test';

import {
  connectVirtualKeyboard,
  playOpeningMeasure,
  playSecondMeasure,
} from './virtualKeyboard';

test('the keyboard says which hand plays each key it is waiting for', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);

  // The hands take this arrangement's melody in turn, so the same G4 changes colour
  // between the right hand's opening phrase and the left hand's echo of it in m3.
  const keyG4 = page.locator('[data-note="67"]');
  await expect(keyG4).toHaveAttribute('data-hand', 'right');

  await playOpeningMeasure(page); // m1
  await playSecondMeasure(page); // m2

  await expect(keyG4).toHaveAttribute('data-hand', 'left');
});
