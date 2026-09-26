import { describe, expect, it } from 'vitest';

import { cichaNocScore } from '../score/cichaNoc';
import type { Note, Score } from '../score/types';
import { handPositions } from './handPosition';

const firstEventOf = (measure: number) =>
  cichaNocScore.events.findIndex((event) => event.measure === measure);

/** Each hand's keys as [pitch, finger] pairs, lowest key first. */
function keysOf(positions: ReturnType<typeof handPositions>, hand: Note['hand']) {
  return positions
    .filter((key) => key.hand === hand)
    .map((key) => [key.pitch, key.finger])
    .sort(([a], [b]) => a - b);
}

/** A one-event score holding one fingered right-hand note, in the given key. */
function oneNote(pitch: number, fifths: number): Score {
  return {
    title: '',
    divisions: 1,
    timeSignatures: [{ beats: 4, beatType: 4, measure: 1 }],
    events: [
      {
        id: 'm1-b1-e1',
        notes: [{ pitch, hand: 'right', finger: 1 }],
        measure: 1,
        beat: 1,
        startTime: 0,
        durationBeats: 4,
      },
    ],
    fifths,
    measureCount: 1,
  };
}

describe('handPositions', () => {
  it('places each hand where its next note is, the left numbered from its little finger', () => {
    const positions = handPositions(cichaNocScore, 0);

    // E4-B4 on 1-5, from m1's G4 on 3.
    expect(keysOf(positions, 'right')).toEqual([
      [64, 1],
      [65, 2],
      [67, 3],
      [69, 4],
      [71, 5],
    ]);
    // E3-B3 on 5-1, from m3's G3 on 3: the left hand is idle but shows where it comes in.
    expect(keysOf(positions, 'left')).toEqual([
      [52, 5],
      [53, 4],
      [55, 3],
      [57, 2],
      [59, 1],
    ]);
  });

  it('moves a hand when its next note fixes a new position', () => {
    // m5's D5 on 3: the right hand has moved up to B4-F5.
    expect(keysOf(handPositions(cichaNocScore, firstEventOf(5)), 'right')).toEqual([
      [71, 1],
      [72, 2],
      [74, 3],
      [76, 4],
      [77, 5],
    ]);
    // m7's C4 on the thumb puts the left hand on F3-C4, and m8's G3 on 3 takes it back.
    expect(keysOf(handPositions(cichaNocScore, firstEventOf(7)), 'left')).toEqual([
      [53, 5],
      [55, 4],
      [57, 3],
      [59, 2],
      [60, 1],
    ]);
    expect(keysOf(handPositions(cichaNocScore, firstEventOf(8)), 'left')[0]).toEqual([
      52, 5,
    ]);
  });

  it('shows nothing past the end of the piece', () => {
    expect(handPositions(cichaNocScore, cichaNocScore.events.length)).toEqual([]);
  });

  it('looks ahead only as far as the loop goes before wrapping', () => {
    const positions = handPositions(cichaNocScore, 0, { startMeasure: 1, endMeasure: 2 });

    // The left hand does not play in bars 1-2, so it has no position there.
    expect(keysOf(positions, 'left')).toEqual([]);
    expect(keysOf(positions, 'right')[0]).toEqual([64, 1]);
  });

  it('steps along the key signature, not the white keys', () => {
    // F major: a thumb on F4 puts finger 4 on B-flat, not B.
    expect(keysOf(handPositions(oneNote(65, -1), 0), 'right')).toEqual([
      [65, 1],
      [67, 2],
      [69, 3],
      [70, 4],
      [72, 5],
    ]);
  });

  it('gives no position when the note it would step from is outside the key', () => {
    // F#4 in C major.
    expect(handPositions(oneNote(66, 0), 0)).toEqual([]);
  });
});
