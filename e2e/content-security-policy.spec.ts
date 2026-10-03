import { expect, test } from '@playwright/test';

import { recordCspViolations } from './page';
import { connectVirtualKeyboard, playOpeningMeasure } from './virtualKeyboard';

// Runs against the built app, the only one that carries the policy (see vite.config.ts), so
// a dependency that starts injecting a style or loading an image the policy blocks fails here
// rather than on GitHub Pages. OSMD's cursor is a data: image, and drawing it is part of this.
test('the built app works under its Content-Security-Policy', async ({ page }) => {
  await recordCspViolations(page);

  await connectVirtualKeyboard(page);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await expect(page.getByTestId('staff').locator('svg')).toBeVisible();
  await expect(page.getByTestId('staff').locator('img')).toBeVisible();

  await playOpeningMeasure(page);
  const listen = page.getByTestId('listen-to-piece');
  await listen.click();
  await expect(listen).toHaveText('Stop');
  await listen.click();

  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
});
