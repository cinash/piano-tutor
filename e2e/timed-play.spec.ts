import { expect, test, type Locator, type Page } from '@playwright/test';

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

/** Where OSMD has put the cursor, read as e2e/staff-cursor.spec.ts reads it. */
function cursorPosition(cursor: Locator) {
  return cursor.evaluate((el) => `${el.style.left} ${el.style.top}`);
}

// OSMD is stubbed in jsdom, so only a browser shows the cursor following the clock.
test('in Timed, the staff cursor moves with the music rather than with the engine', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);
  await page.getByTestId('demo-speed-select').selectOption('50%');
  await page.getByTestId('mode-timed').check();
  // No click to snap to, so the clock starts on the note itself.
  await page.getByTestId('metronome-checkbox').uncheck();
  const cursor = page.getByTestId('staff').locator('img');
  await expect(cursor).toBeVisible();
  const onG4 = await cursorPosition(cursor);

  // Timed from before the press, as e2e/listen.spec.ts times: the note can only be later.
  const pressedAt = Date.now();
  await playChord(page, [67]);

  // The engine moves on to A4 at once; the music reaches it 2727 ms after G4 at 50%.
  await page.waitForTimeout(1_000 - (Date.now() - pressedAt));
  expect(await cursorPosition(cursor)).toBe(onG4);

  await expect.poll(() => cursorPosition(cursor), { intervals: [50] }).not.toBe(onG4);
  expect(Date.now() - pressedAt).toBeGreaterThanOrEqual(2_727);
  // Before A4's window closes: the cursor moved because its time came, not a miss.
  expect((await practiceState(page))?.missedNoteCount).toBe(0);
});
