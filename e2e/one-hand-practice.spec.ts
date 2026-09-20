import { expect, test, type Page } from '@playwright/test';

import { connectVirtualKeyboard, playChord } from './virtualKeyboard';

/** The ids of the events the queue is currently showing, in queue order. */
function queuedEventIds(page: Page) {
  return page
    .getByTestId('falling-note-event')
    .evaluateAll((events) => events.map((event) => event.getAttribute('data-event-id')));
}

test('practising one hand queues only that hand, and switching hands restarts', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);
  await page.getByTestId('hands-left').check();

  // The left hand plays once a measure here, so the queue skips m1 b4 and b5 entirely
  // rather than showing them as events with no notes left in them.
  await expect
    .poll(() => queuedEventIds(page))
    .toEqual(['m1-b1-e1', 'm2-b1-e1', 'm3-b1-e1', 'm4-b1-e1']);

  await playChord(page, [48, 55]); // m1 b1, the left hand's half of the opening chord
  await expect
    .poll(() => page.evaluate(() => window.__practiceState?.nextEventIndex))
    .toBe(1);

  await page.getByTestId('hands-right').check();

  // The attempt starts again: index 1 of the right hand's list is a different note.
  await expect
    .poll(() => page.evaluate(() => window.__practiceState?.nextEventIndex))
    .toBe(0);
  await expect
    .poll(() => page.evaluate(() => window.__practiceState?.notesPlayed))
    .toBe(0);

  // m1 b1 is now G4 alone, in the right hand's colour; the left hand's C3 and G3 are
  // no longer waited for.
  await expect(page.locator('[data-note="67"]')).toHaveAttribute('data-hand', 'right');
  await expect(page.locator('[data-note="48"]')).toHaveAttribute(
    'data-expected',
    'false',
  );
  await expect(page.locator('[data-note="55"]')).toHaveAttribute(
    'data-expected',
    'false',
  );
});
