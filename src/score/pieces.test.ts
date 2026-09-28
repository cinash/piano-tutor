import { describe, expect, it } from 'vitest';

import { measureStartTime, timeSignatureAt } from './measureStartTime';
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

  // What timed play assumes of every piece: one signature over quarter-note beats, so the
  // click and its accents are periodic; no pickup or short bar, so a bar starts where
  // measureStartTime says; and events at least half a beat apart, so the ±¼-beat windows
  // never overlap. A piece added that fails this needs timed play extended, leaving out,
  // or offering for wait-mode only — the decision of whoever adds its line.
  it.each(PIECES)('$id is one that timed play can keep time through', ({ score }) => {
    const startTimes = score.events.map((event) => event.startTime);

    // parseScore records only a change, so nothing after bar 1 means one signature.
    expect(score.timeSignatures.filter((signature) => signature.measure > 1)).toEqual([]);
    expect(timeSignatureAt(score, 1).beatType).toBe(4);
    for (const { measure, startTime } of score.events) {
      expect(startTime).toBeGreaterThanOrEqual(measureStartTime(score, measure));
      expect(startTime).toBeLessThan(measureStartTime(score, measure + 1));
    }
    for (let i = 1; i < startTimes.length; i++) {
      expect(startTimes[i] - startTimes[i - 1]).toBeGreaterThanOrEqual(0.5);
    }
  });
});
