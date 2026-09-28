import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { connectVirtualKeyboard, playOpeningMeasure } from './virtualKeyboard';

test('downloads the history and imports it back into a browser with none', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);
  await playOpeningMeasure(page); // three notes, all of them right

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-progress').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^progress-\d+\.json$/);
  const exported: unknown = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported).toMatchObject([
    {
      notesPlayed: 3,
      wrongNoteCount: 0,
      reachedEnd: false,
      piece: 'cicha-noc',
      hands: 'both',
    },
  ]);

  // The reload is what makes the import assertion below discriminating: without it the
  // row is still in React state and would be there whether or not the import did anything.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('attempt-history-empty')).toBeVisible();

  await page.getByTestId('import-progress-input').setInputFiles(await download.path());

  const rows = page.getByTestId('attempt-history-row');
  await expect(rows).toHaveCount(1);
  // The first cell is a wall-clock time, so it's matched loosely.
  await expect(rows.locator('td')).toHaveText([
    /\d/,
    'Cicha Noc',
    'Wait',
    'whole piece',
    '3',
    '0',
    '—',
    '100%',
    'no',
  ]);
});

test('reports a file that is not an attempt history through the error line', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByTestId('import-progress-input').setInputFiles({
    name: 'not-progress.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"attempts": []}'),
  });

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('attempt-history-empty')).toBeVisible();
});
