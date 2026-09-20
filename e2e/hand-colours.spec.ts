import { expect, test } from '@playwright/test';

import { connectVirtualKeyboard } from './virtualKeyboard';

test('the keyboard says which hand plays each key it is waiting for', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);

  // m1 b1 is C3 and G3 in the left hand under G4 in the right.
  await expect(page.locator('[data-note="48"]')).toHaveAttribute('data-hand', 'left');
  await expect(page.locator('[data-note="55"]')).toHaveAttribute('data-hand', 'left');
  await expect(page.locator('[data-note="67"]')).toHaveAttribute('data-hand', 'right');
});
