import { expect, test, type Page } from '@playwright/test';

/**
 * VirtualKeyboardSource's QWERTY-row mapping (src/midi/VirtualKeyboardSource.ts), for the
 * pitches cicha-noc.musicxml's opening bars use. Driving the app through real key presses
 * avoids the timing-based scheduling a ReplayMidiSource fixture would need — no margin to
 * get wrong, per the flake step 1's merge commit fixed.
 */
const KEY_FOR_PITCH: Record<number, string> = {
  48: 'z', // C3
  55: 'b', // G3
  64: 'e', // E4
  67: 't', // G4
};

async function playChord(page: Page, pitches: number[]) {
  const keys = pitches.map((pitch) => KEY_FOR_PITCH[pitch]);
  for (const key of keys) await page.keyboard.down(key);
  for (const key of keys) await page.keyboard.up(key);
}

async function connectVirtualKeyboard(page: Page) {
  await page.goto('/');
  await page.getByTestId('use-virtual-keyboard').click();
  await expect(page.getByTestId('source-status')).toHaveText(
    'Connected: computer keyboard',
  );
}

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

    await playChord(page, [67, 48, 55]); // m1 b1: RH melody note + LH chord
    await playChord(page, [67]); // m1 b4
    await playChord(page, [64]); // m1 b5
    await playChord(page, [67, 48, 55]); // m2 b1
    await playChord(page, [67]); // m2 b4
    await playChord(page, [64]); // m2 b5

    await expect
      .poll(() => page.evaluate(() => window.__practiceState?.nextEventIndex))
      .toBe(6);

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
});
