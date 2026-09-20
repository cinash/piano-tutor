import { expect, test } from '@playwright/test';

test('the keyboard names its white keys, middle C reading C4', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('[data-note="60"]')).toHaveText('C4');
});

/**
 * The one committed screenshot of the keyboard, taken here rather than in steps 9-12:
 * the element now has its final width, its expected-key highlight, its hand colours and
 * its labels, so this is written and reviewed once instead of updated four times.
 */
test('the finished keyboard looks right at the start of the piece', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('group', { name: 'On-screen keyboard' })).toHaveScreenshot(
    'piano-keyboard.png',
  );
});
