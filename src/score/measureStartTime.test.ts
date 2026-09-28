import { describe, expect, it } from 'vitest';

import { measureStartTime, timeSignatureAt } from './measureStartTime';
import { PIECES } from './pieces';
import type { Score } from './types';

const inThreeFour: Score = {
  title: 'fixture',
  divisions: 1,
  timeSignatures: [{ beats: 3, beatType: 4, measure: 1 }],
  fifths: 0,
  measureCount: 4,
  events: [],
};

describe('measureStartTime', () => {
  it('sums three beats a bar in 3/4', () => {
    expect([1, 2, 3, 4].map((measure) => measureStartTime(inThreeFour, measure))).toEqual(
      [0, 3, 6, 9],
    );
    expect(timeSignatureAt(inThreeFour, 4)).toMatchObject({ beats: 3, beatType: 4 });
  });

  it('reads a piece with no time signature as 4/4, where its bars really start', () => {
    const beyer12 = PIECES.find((piece) => piece.id === 'beyer-op101-12')!.score;
    const firstOfMeasure3 = beyer12.events.find((event) => event.measure === 3)!;

    expect(beyer12.timeSignatures).toEqual([]);
    expect(timeSignatureAt(beyer12, 3)).toEqual({ beats: 4, beatType: 4 });
    expect(measureStartTime(beyer12, 3)).toBe(8);
    expect(firstOfMeasure3.startTime).toBe(8);
  });
});
