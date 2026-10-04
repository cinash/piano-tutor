import { describe, expect, it } from 'vitest';

import { PIECES } from './pieces';
import {
  COMPUTER_KEYBOARD_HIGH,
  COMPUTER_KEYBOARD_LOW,
  isFingered,
  timedPlayable,
} from './pieceRules';

describe('PIECES', () => {
  it('offers Cicha Noc, then Beyer Nos. 8, 9 and 12-31 in book order', () => {
    const beyer = [8, 9, ...Array.from({ length: 20 }, (_, i) => i + 12)].map(
      (number) => `beyer-op101-${String(number).padStart(2, '0')}`,
    );

    expect(PIECES.map((piece) => piece.id)).toEqual(['cicha-noc', ...beyer]);
  });

  it('gives every piece a title of its own', () => {
    const titles = PIECES.map((piece) => piece.score.title);

    expect(titles.every((title) => title !== '')).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(PIECES)(
    '$id has notes, a finger on every one, and none off the computer keyboard',
    ({ score }) => {
      const notes = score.events.flatMap((event) => event.notes);

      expect(notes.length).toBeGreaterThan(0);
      expect(notes.filter((note) => !isFingered(note.finger))).toEqual([]);
      for (const { pitch } of notes) {
        expect(pitch).toBeGreaterThanOrEqual(COMPUTER_KEYBOARD_LOW);
        expect(pitch).toBeLessThanOrEqual(COMPUTER_KEYBOARD_HIGH);
      }
    },
  );

  // Whoever adds a piece that fails this decides what to do with it; see timedPlayable.
  it.each(PIECES)('$id is one that timed play can keep time through', ({ score }) => {
    expect(timedPlayable(score)).toBe(true);
  });
});
