import { expect, type Page } from '@playwright/test';

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

export async function playChord(page: Page, pitches: number[]) {
  const keys = pitches.map((pitch) => KEY_FOR_PITCH[pitch]);
  for (const key of keys) await page.keyboard.down(key);
  for (const key of keys) await page.keyboard.up(key);
}

export async function connectVirtualKeyboard(page: Page) {
  await page.goto('/');
  await page.getByTestId('use-virtual-keyboard').click();
  await expect(page.getByTestId('source-status')).toHaveText(
    'Connected: computer keyboard',
  );
}

export async function selectLoopRange(
  page: Page,
  startMeasure: number,
  endMeasure: number,
) {
  await page.getByTestId('loop-enabled-checkbox').check();
  await page.getByTestId('loop-start-input').fill(String(startMeasure));
  await page.getByTestId('loop-end-input').fill(String(endMeasure));
  // A focused number input would swallow the virtual keyboard's note keys — see
  // VirtualKeyboardSource's isTypingTarget guard.
  await page.getByTestId('loop-end-input').blur();
}

/** b1, b4, b5 of cicha-noc.musicxml's opening measure — m1 and m2 share this shape. */
export async function playOpeningMeasure(page: Page) {
  await playChord(page, [67, 48, 55]);
  await playChord(page, [67]);
  await playChord(page, [64]);
}
