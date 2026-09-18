import { expect, test, type Page } from '@playwright/test';

import {
  connectVirtualKeyboard,
  playChord,
  playOpeningMeasure,
  selectLoopRange,
} from './virtualKeyboard';

function practiceSnapshot(page: Page) {
  return page.evaluate(() => {
    const state = window.__practiceState;
    return (
      state && {
        nextEventIndex: state.nextEventIndex,
        notesPlayed: state.notesPlayed,
        wrongNoteCount: state.wrongNoteCount,
      }
    );
  });
}

test('Restart returns to the first note and starts a fresh attempt, keeping the loop', async ({
  page,
}) => {
  await connectVirtualKeyboard(page);
  await selectLoopRange(page, 1, 2);

  await playChord(page, [64]); // E4 — neither the current nor the next expected note
  await playOpeningMeasure(page); // m1: five more notes, all of them right

  await expect
    .poll(() => practiceSnapshot(page))
    .toEqual({
      nextEventIndex: 3,
      notesPlayed: 6,
      wrongNoteCount: 1,
    });

  await page.getByTestId('restart-practice').click();

  await expect
    .poll(() => practiceSnapshot(page))
    .toEqual({
      nextEventIndex: 0,
      notesPlayed: 0,
      wrongNoteCount: 0,
    });
  await expect(page.getByTestId('loop-start-input')).toHaveValue('1');
  await expect(page.getByTestId('loop-end-input')).toHaveValue('2');
});
