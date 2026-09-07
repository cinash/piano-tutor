import { describe, expect, it } from 'vitest';

import type { MidiEvent } from '../midi/types';
import type { Score } from '../score/types';
import { advancePracticeView, createInitialPracticeViewState } from './practiceView';

/** Mirrors cicha-noc m1 b1-b2: a RH+LH chord, then a distinct RH-only event while the LH sustains. */
const SCORE: Score = {
  title: 'fixture',
  divisions: 4,
  timeSignatures: [{ beats: 4, beatType: 4, measure: 1 }],
  measureCount: 1,
  events: [
    {
      id: 'e0',
      notes: [
        { pitch: 67, hand: 'right', finger: 5 },
        { pitch: 48, hand: 'left', finger: 5 },
        { pitch: 55, hand: 'left', finger: 1 },
      ],
      measure: 1,
      beat: 1,
      startTime: 0,
      durationBeats: 1,
    },
    {
      id: 'e1',
      notes: [{ pitch: 69, hand: 'right', finger: 5 }],
      measure: 1,
      beat: 2,
      startTime: 1,
      durationBeats: 1,
    },
  ],
};

function play(events: MidiEvent[]) {
  return events.reduce(
    (state, event) => advancePracticeView(state, SCORE, event, event.time),
    createInitialPracticeViewState(),
  );
}

describe('advancePracticeView', () => {
  it('a genuinely wrong note is tracked while held, and cleared once released', () => {
    const held = play([{ type: 'noteOn', note: 64, velocity: 100, time: 0 }]);
    expect(held.wrongNotes).toEqual(new Set([64]));

    const released = advancePracticeView(
      held,
      SCORE,
      { type: 'noteOff', note: 64, time: 10 },
      10,
    );
    expect(released.wrongNotes.size).toBe(0);
  });

  it('a sustained correct note is not retroactively flagged wrong once the engine advances past it', () => {
    const result = play([
      { type: 'noteOn', note: 67, velocity: 100, time: 0 },
      { type: 'noteOn', note: 48, velocity: 100, time: 0 },
      { type: 'noteOn', note: 55, velocity: 100, time: 0 },
      // e0 is now satisfied; 48 and 55 (the LH chord) stay held while the RH moves on
      { type: 'noteOff', note: 67, time: 100 },
      { type: 'noteOn', note: 69, velocity: 100, time: 200 }, // e1
    ]);

    expect(result.engine.nextEventIndex).toBe(2);
    expect(result.wrongNotes.size).toBe(0);
  });

  it('an early note for the next event is not flagged wrong while the current one is still open', () => {
    const result = play([{ type: 'noteOn', note: 69, velocity: 100, time: 0 }]);
    expect(result.wrongNotes.size).toBe(0);
  });
});
