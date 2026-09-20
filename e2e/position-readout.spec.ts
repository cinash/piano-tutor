import { expect, test } from '@playwright/test';

import { connectVirtualKeyboard, playOpeningMeasure } from './virtualKeyboard';

test('the readout names the measure being played, and moves on with the piece', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);

  const readout = page.getByTestId('position-readout');
  await expect(readout).toHaveText('Measure 1 of 12');

  await playOpeningMeasure(page);

  await expect(readout).toHaveText('Measure 2 of 12');
});
