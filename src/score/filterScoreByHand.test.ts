import { describe, expect, it } from 'vitest';

import { filterScoreByHand } from './filterScoreByHand';
import type { Score } from './types';

/** A both-hands chord, a right-hand note on its own, then a left-hand note on its own. */
const SCORE: Score = {
  title: 'fixture',
  divisions: 4,
  timeSignatures: [{ beats: 4, beatType: 4, measure: 1 }],
  measureCount: 12,
  events: [
    {
      id: 'chord',
      notes: [
        { pitch: 67, hand: 'right' },
        { pitch: 48, hand: 'left' },
      ],
      measure: 1,
      beat: 1,
      startTime: 0,
      durationBeats: 1,
    },
    {
      id: 'right-only',
      notes: [{ pitch: 64, hand: 'right' }],
      measure: 1,
      beat: 2,
      startTime: 1,
      durationBeats: 1,
    },
    {
      id: 'left-only',
      notes: [{ pitch: 53, hand: 'left' }],
      measure: 2,
      beat: 1,
      startTime: 4,
      durationBeats: 1,
    },
  ],
};

describe('filterScoreByHand', () => {
  it('returns the score unchanged for both hands', () => {
    expect(filterScoreByHand(SCORE, 'both')).toBe(SCORE);
  });

  it('narrows a two-hand chord to the selected hand', () => {
    const [chord] = filterScoreByHand(SCORE, 'left').events;
    expect(chord.id).toBe('chord');
    expect(chord.notes).toEqual([{ pitch: 48, hand: 'left' }]);
  });

  it('drops the events the other hand plays alone', () => {
    expect(filterScoreByHand(SCORE, 'left').events.map((event) => event.id)).toEqual([
      'chord',
      'left-only',
    ]);
    expect(filterScoreByHand(SCORE, 'right').events.map((event) => event.id)).toEqual([
      'chord',
      'right-only',
    ]);
  });

  it('keeps the measure count of the whole piece', () => {
    expect(filterScoreByHand(SCORE, 'left').measureCount).toBe(12);
  });
});
