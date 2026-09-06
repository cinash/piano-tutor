import { describe, expect, it } from 'vitest';

import { computeKeyboardLayout } from './keyboardLayout';

describe('computeKeyboardLayout', () => {
  it('lays out one octave (C4-C5) as 8 equal-width white keys spanning the full width', () => {
    const layout = computeKeyboardLayout(60, 72);
    const white = layout.filter((k) => k.color === 'white');

    expect(white).toHaveLength(8);
    expect(white.every((k) => k.widthPercent === 12.5)).toBe(true);
    expect(white.map((k) => k.leftPercent)).toEqual([
      0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5,
    ]);
  });

  it('centers each black key on the boundary between its neighboring white keys', () => {
    const layout = computeKeyboardLayout(60, 72);
    const cSharp4 = layout.find((k) => k.note === 61);

    expect(cSharp4).toMatchObject({ color: 'black' });
    // The C/D boundary sits at 12.5%; the black key is centered on it.
    expect(cSharp4!.leftPercent + cSharp4!.widthPercent / 2).toBeCloseTo(12.5);
  });

  it('never places a black key between E/F or B/C, matching a real keyboard', () => {
    const layout = computeKeyboardLayout(60, 72);
    const blackNotes = layout.filter((k) => k.color === 'black').map((k) => k.note);

    // E4=64, F4=65, B4=71, C5=72 — none of these should be black.
    expect(blackNotes).not.toContain(65);
    expect(blackNotes).not.toContain(72);
  });

  it('covers every note in the requested range exactly once', () => {
    const layout = computeKeyboardLayout(48, 67); // the C3-G4 range this piece uses
    expect(layout.map((k) => k.note)).toEqual(
      Array.from({ length: 67 - 48 + 1 }, (_, i) => 48 + i),
    );
  });

  it('rejects a range where highNote is below lowNote', () => {
    expect(() => computeKeyboardLayout(67, 48)).toThrow();
  });

  it('rejects a single-note range that lands on a black key', () => {
    expect(() => computeKeyboardLayout(61, 61)).toThrow(); // C#4, no white key to anchor on
  });

  it('handles a single-note range', () => {
    expect(computeKeyboardLayout(60, 60)).toEqual([
      { note: 60, color: 'white', leftPercent: 0, widthPercent: 100 },
    ]);
  });
});
