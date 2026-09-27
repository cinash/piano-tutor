import { describe, expect, it } from 'vitest';

import { PIECES } from './pieces';

// C3 to G5: VirtualKeyboardSource's map, which is not exported for a test's sake.
const COMPUTER_KEYBOARD_LOW = 48;
const COMPUTER_KEYBOARD_HIGH = 79;

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
      expect(notes.filter((note) => note.finger === undefined)).toEqual([]);
      for (const { pitch } of notes) {
        expect(pitch).toBeGreaterThanOrEqual(COMPUTER_KEYBOARD_LOW);
        expect(pitch).toBeLessThanOrEqual(COMPUTER_KEYBOARD_HIGH);
      }
    },
  );
});
