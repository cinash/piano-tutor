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

  // The left hand is silent until m3 here, so the queue skips m1 and m2 entirely rather
  // than showing their events with no notes left in them.
  await expect
    .poll(() => queuedEventIds(page))
    .toEqual(['m3-b1-e1', 'm3-b2.5-e1', 'm3-b3-e1', 'm4-b1-e1']);

  await playChord(page, [67]); // m3 b1, the left hand's first note
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

  // The queue is the right hand's now, starting at m1 rather than m3, and the G4 it
  // waits for carries the right hand's colour instead of the left's.
  await expect
    .poll(() => queuedEventIds(page))
    .toEqual(['m1-b1-e1', 'm1-b2.5-e1', 'm1-b3-e1', 'm2-b1-e1']);
  await expect(page.locator('[data-note="67"]')).toHaveAttribute('data-hand', 'right');
});
