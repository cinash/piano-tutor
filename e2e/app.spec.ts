import { expect, test } from '@playwright/test';

test('the page loads and says OK', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('OK')).toBeVisible();
});
