import { expect, test, type Locator } from '@playwright/test';

import { connectVirtualKeyboard } from './virtualKeyboard';

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

test('the controls above the staff sit in two rows, not one line each', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);
  const middleOf = async (locator: Locator) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error('not laid out');
    return box.y + box.height / 2;
  };

  const firstRow = await middleOf(page.getByRole('heading', { name: 'piano-tutor' }));
  expect(await middleOf(page.getByTestId('disconnect-button'))).toBeCloseTo(firstRow, 0);
  expect(await middleOf(page.getByTestId('webmidi-device-select'))).toBeCloseTo(
    firstRow,
    0,
  );

  const secondRow = await middleOf(page.getByTestId('restart-practice'));
  expect(secondRow).toBeGreaterThan(firstRow);
  expect(await middleOf(page.getByTestId('listen-to-piece'))).toBeCloseTo(secondRow, 0);
  expect(await middleOf(page.getByTestId('demo-speed-select'))).toBeCloseTo(secondRow, 0);
});
