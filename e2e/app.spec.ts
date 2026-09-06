import { expect, test } from '@playwright/test';

test('the page loads and shows the on-screen keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'piano-tutor' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'On-screen keyboard' })).toBeVisible();
});
