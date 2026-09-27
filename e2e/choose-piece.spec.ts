import { expect, test, type Page } from '@playwright/test';

import { connectVirtualKeyboard } from './virtualKeyboard';

const staffWidth = (page: Page) =>
  page
    .getByTestId('staff')
    .locator('svg')
    .evaluate((svg) => svg.getBoundingClientRect().width);

const expectedPitches = (page: Page) =>
  page
    .locator('[data-expected="true"]')
    .evaluateAll((keys) => keys.map((key) => Number(key.getAttribute('data-note'))));

test('choosing a piece redraws the staff with it, and practises it', async ({ page }) => {
  await page.goto('/');
  const staff = page.getByTestId('staff');
  await expect(staff.locator('.staffline')).toHaveCount(2);
  const cichaNocWidth = await staffWidth(page);

  await page.getByTestId('piece-select').selectOption('beyer-op101-12');

  // Eight busy bars against Cicha Noc's 22, about 55% of its width: this fails if the
  // staff keeps drawing the old piece, which the readout and the keys below cannot show —
  // they follow App's score.
  await expect.poll(() => staffWidth(page)).toBeLessThan(cichaNocWidth * 0.75);
  // One score, one staff line per hand: not the new piece appended below the old.
  await expect(staff.locator('.staffline')).toHaveCount(2);
  await expect(page.getByTestId('position-readout')).toHaveText('Measure 1 of 8');
  expect(await expectedPitches(page)).toEqual([60, 72]);
});

test('a letter typed after choosing plays a note rather than changing the piece', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);
  const select = page.getByTestId('piece-select');
  // selectOption alone leaves focus where it was; a click to choose leaves it here.
  await select.focus();
  await select.selectOption('beyer-op101-12');

  await page.keyboard.down('c'); // E3 on the computer keyboard; "Cicha Noc" starts with C

  await expect(page.locator('[data-note="52"]')).toHaveAttribute('data-held', 'true');
  await page.keyboard.up('c');
  await expect(select).toHaveValue('beyer-op101-12');
});

test('the chosen piece is still chosen after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('piece-select').selectOption('beyer-op101-12');

  await page.reload();

  await expect(page.getByTestId('piece-select')).toHaveValue('beyer-op101-12');
  await expect(page.getByTestId('position-readout')).toHaveText('Measure 1 of 8');
});
