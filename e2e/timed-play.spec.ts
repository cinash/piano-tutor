import { expect, test, type Page } from '@playwright/test';

import { connectVirtualKeyboard, playChord } from './virtualKeyboard';

const practiceState = (page: Page) => page.evaluate(() => window.__practiceState);

test('in Timed, a note not played in time is missed and the piece goes on', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);
  await page.getByTestId('mode-timed').check();
  // No click to snap to: the clock starts on the note itself.
  await page.getByTestId('metronome-checkbox').uncheck();

  await playChord(page, [67]); // Cicha Noc's G4 starts the clock; then nothing

  // A4's window closes 1591 ms after G4 at 100%.
  await expect
    .poll(async () => (await practiceState(page))?.missedNoteCount)
    .toBeGreaterThanOrEqual(1);
  expect((await practiceState(page))?.nextEventIndex).toBeGreaterThan(1);
});

// jsdom's select does not jump on a typed key, so only a browser can fail this.
test('a note key typed on the focused Speed select plays rather than changing speed', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);
  const speed = page.getByTestId('demo-speed-select');
  await speed.focus();

  await page.keyboard.down('5'); // F♯4 on the computer keyboard; "50%" starts with 5

  await expect(page.locator('[data-note="66"]')).toHaveAttribute('data-held', 'true');
  await page.keyboard.up('5');
  await expect(speed).toHaveValue('100%');
});
