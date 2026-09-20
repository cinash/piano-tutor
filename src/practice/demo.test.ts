import { describe, expect, it } from 'vitest';

import { cichaNocScore } from '../score/cichaNoc';
import type { Score, ScoreEvent } from '../score/types';
import { buildDemoSchedule } from './demo';

/** A quarter-note beat is 1000 ms at 60 bpm, so the millisecond arithmetic reads as beats. */
const BPM = 60;

const quarterNote = (id: string, startTime: number, pitch: number): ScoreEvent => ({
  id,
  notes: [{ pitch, hand: 'right' }],
  measure: 1,
  beat: 1,
  startTime,
  durationBeats: 1,
});

/** A quarter note, a beat of rest, a quarter note — cicha-noc.musicxml has one such gap. */
const withAGap: Score = {
  title: 'fixture',
  divisions: 1,
  timeSignatures: [{ beats: 4, beatType: 4, measure: 1 }],
  measureCount: 1,
  events: [quarterNote('a', 0, 60), quarterNote('b', 2, 62)],
};

describe('buildDemoSchedule', () => {
  it('sounds one event at a time, each until the next one begins', () => {
    const steps = buildDemoSchedule(cichaNocScore, BPM);

    // m1 b1's C3-G3-G4 is written over three beats but m1 b4 arrives after one and a
    // half, so the chord is clamped to it: no silence between them, and no note-off
    // landing inside the G4 that follows.
    expect(steps.slice(0, 3)).toEqual([
      { atMs: 0, pitches: new Set([67, 48, 55]) },
      { atMs: 1500, pitches: new Set([67]) },
      { atMs: 2000, pitches: new Set([64]) },
    ]);
  });

  it('closes the last event with a step that sounds nothing', () => {
    const steps = buildDemoSchedule(cichaNocScore, BPM);
    const last = cichaNocScore.events[cichaNocScore.events.length - 1];

    expect(steps.at(-1)).toEqual({
      atMs: (last.startTime + last.durationBeats) * 1000,
      pitches: new Set(),
    });
  });

  it('falls silent across a gap between one event and the next', () => {
    // parseScore drops rests, so a rest reaches the demo only as the distance between
    // one event's end and the next event's start.
    expect(buildDemoSchedule(withAGap, BPM)).toEqual([
      { atMs: 0, pitches: new Set([60]) },
      { atMs: 1000, pitches: new Set() },
      { atMs: 2000, pitches: new Set([62]) },
      { atMs: 3000, pitches: new Set() },
    ]);
  });
});
