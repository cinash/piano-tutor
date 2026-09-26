import { describe, expect, it } from 'vitest';

import { createInitialState } from '../engine/advance';
import type { Score } from '../score/types';
import { formatPosition } from './positionReadout';

/** Two events a couple of measures apart, in a piece longer than either of them. */
const SCORE: Score = {
  title: 'fixture',
  divisions: 4,
  timeSignatures: [{ beats: 4, beatType: 4, measure: 1 }],
  fifths: 0,
  measureCount: 12,
  events: [
    {
      id: 'e0',
      notes: [{ pitch: 60, hand: 'right' }],
      measure: 1,
      beat: 1,
      startTime: 0,
      durationBeats: 1,
    },
    {
      id: 'e1',
      notes: [{ pitch: 62, hand: 'right' }],
      measure: 3,
      beat: 1,
      startTime: 8,
      durationBeats: 1,
    },
  ],
};

describe('formatPosition', () => {
  it('reads the first measure before anything is played', () => {
    expect(formatPosition(SCORE, createInitialState())).toBe('Measure 1 of 12');
  });

  it('names the measure of the event being waited for', () => {
    const engine = { ...createInitialState(), nextEventIndex: 1 };
    expect(formatPosition(SCORE, engine)).toBe('Measure 3 of 12');
  });

  it('reads Complete when the index has run past the last event', () => {
    const engine = {
      ...createInitialState(),
      status: 'complete' as const,
      nextEventIndex: SCORE.events.length,
    };
    expect(formatPosition(SCORE, engine)).toBe('Complete');
  });
});
