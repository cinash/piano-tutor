import { expect, test } from '@playwright/test';

test('the page loads and shows the on-screen keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'piano-tutor' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'On-screen keyboard' })).toBeVisible();
});

test('the keyboard-range select renders the default 4-octave keyboard, then 88 keys', async ({
  page,
}) => {
  await page.goto('/');
  const keys = page.locator('[data-note]');
  const whiteKeys = page.locator('.piano-key--white');

  await expect(keys).toHaveCount(48);
  await expect(whiteKeys).toHaveCount(28);

  await page.getByTestId('keyboard-range-select').selectOption('88 keys');

  await expect(keys).toHaveCount(88);
  await expect(whiteKeys).toHaveCount(52);
});
