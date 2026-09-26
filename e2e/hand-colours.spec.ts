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

  // The right hand opens on G4; the left hand echoes the phrase an octave lower in m3,
  // starting on G3, to the left of every key the right hand used.
  const keyG4 = page.locator('[data-note="67"]');
  await expect(keyG4).toHaveAttribute('data-hand', 'right');

  await playOpeningMeasure(page); // m1
  await playSecondMeasure(page); // m2

  await expect(page.locator('[data-note="55"]')).toHaveAttribute('data-hand', 'left');
});
