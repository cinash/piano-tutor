import { expect, test } from '@playwright/test';

import {
  connectVirtualKeyboard,
  playOpeningMeasure,
  playSecondMeasure,
  selectLoopRange,
} from './virtualKeyboard';

test.describe('falling-note view', () => {
  test('shows the upcoming queue at the start of the piece', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('falling-notes')).toHaveScreenshot(
      'falling-notes-start.png',
    );
  });

  test('the queue advances as the correct notes are played, mid-piece', async ({
    page,
  }) => {
    await connectVirtualKeyboard(page);
    await playOpeningMeasure(page); // m1
    await playSecondMeasure(page); // m2

    await expect
      .poll(() => page.evaluate(() => window.__practiceState?.nextEventIndex))
      .toBe(4);

    await expect(page.getByTestId('falling-notes')).toHaveScreenshot(
      'falling-notes-mid-piece.png',
    );
  });

  test('a wrong note is visibly held without advancing the queue', async ({ page }) => {
    await connectVirtualKeyboard(page);

    await page.keyboard.down('e'); // E4 (64) is neither the current nor the next expected note
    await expect
      .poll(() => page.evaluate(() => window.__practiceState?.heldNotes))
      .toEqual([64]);
    await expect
      .poll(() => page.evaluate(() => window.__practiceState?.nextEventIndex))
      .toBe(0);

    await expect(page.getByTestId('falling-notes')).toHaveScreenshot(
      'falling-notes-waiting-for-wrong-note.png',
    );
  });

  test('a loop wraps the queue back to its start once the range is played through', async ({
    page,
  }) => {
    await connectVirtualKeyboard(page);
    await selectLoopRange(page, 1, 2);

    // Confirms playback actually moved off the start before the second measure wraps it
    // back, rather than the queue never having advanced at all.
    await playOpeningMeasure(page); // m1
    await expect
      .poll(() => page.evaluate(() => window.__practiceState?.nextEventIndex))
      .toBe(3);

    await playSecondMeasure(page); // m2: reaching m3 b1 would move past endMeasure 2
    await expect
      .poll(() => page.evaluate(() => window.__practiceState?.nextEventIndex))
      .toBe(0); // wrapped back to m1 b1, not advanced to m3

    await expect(page.getByTestId('falling-notes')).toHaveScreenshot(
      'falling-notes-loop-boundary.png',
    );
  });
});
