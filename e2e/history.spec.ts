import { expect, test, type Page } from '@playwright/test';

import { connectVirtualKeyboard, playChord, playOpeningMeasure } from './virtualKeyboard';

async function expectBothAttempts(page: Page) {
  const rows = page.getByTestId('attempt-history-row');
  await expect(rows).toHaveCount(2);
  // Newest first: the single wrong note played after Restart, then the opening measure.
  // The first cell is a wall-clock time, so it's matched loosely.
  await expect(rows.nth(0).locator('td')).toHaveText([
    /\d/,
    'whole piece',
    '1',
    '1',
    '0%',
    'no',
  ]);
  await expect(rows.nth(1).locator('td')).toHaveText([
    /\d/,
    'whole piece',
    '3',
    '0',
    '100%',
    'no',
  ]);
}

test('lists each attempt newest first and keeps them across a reload', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);

  await playOpeningMeasure(page); // three notes, all of them right
  await page.getByTestId('restart-practice').click();
  await playChord(page, [64]); // E4 — neither the current nor the next expected note

  await expectBothAttempts(page);

  await page.reload();

  await expectBothAttempts(page);
});

test('records nothing for a session with no notes played', async ({ page }) => {
  await connectVirtualKeyboard(page);

  await page.reload();

  await expect(page.getByTestId('attempt-history-empty')).toBeVisible();
});
