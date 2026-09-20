import { describe, expect, it } from 'vitest';

import { noteName } from './noteName';

describe('noteName', () => {
  it('names a full octave from middle C, spelling the black keys as sharps', () => {
    const octave = Array.from({ length: 12 }, (_, i) => noteName(60 + i));

    expect(octave).toEqual([
      'C4',
      'C♯4',
      'D4',
      'D♯4',
      'E4',
      'F4',
      'F♯4',
      'G4',
      'G♯4',
      'A4',
      'A♯4',
      'B4',
    ]);
  });

  it('increments the octave number at C, not at A', () => {
    expect(noteName(59)).toBe('B3');
    expect(noteName(60)).toBe('C4');
    expect(noteName(71)).toBe('B4');
    expect(noteName(72)).toBe('C5');
  });

  it('names both ends of the 88-key range', () => {
    expect(noteName(21)).toBe('A0');
    expect(noteName(108)).toBe('C8');
  });
});
