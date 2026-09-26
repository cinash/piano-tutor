import { describe, expect, it } from 'vitest';

import type { MidiEvent } from '../midi/types';
import type { Score } from '../score/types';
import { advance, createInitialState, setLoop } from './advance';
import {
  dropNote,
  dropNoteOn,
  generatePerfectPerformance,
  insertNote,
  MS_PER_BEAT,
  replacePitch,
  shiftNoteOff,
  shiftNoteOn,
} from './syntheticPerformance';
import { ENGINE_TIMING, type EngineState } from './types';

/**
 * A single note (e0), a three-note chord spanning both hands (e1), then another
 * single note (e2) — enough shapes to exercise every Layer 2 case below. Pitches
 * are distinct across events so a mutator can target one by pitch unambiguously.
 */
const SCORE: Score = {
  title: 'fixture',
  divisions: 4,
  timeSignatures: [{ beats: 4, beatType: 4, measure: 1 }],
  fifths: 0,
  measureCount: 1,
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
      notes: [
        { pitch: 62, hand: 'right' },
        { pitch: 65, hand: 'right' },
        { pitch: 69, hand: 'left' },
      ],
      measure: 1,
      beat: 2,
      startTime: 1,
      durationBeats: 1,
    },
    {
      id: 'e2',
      notes: [{ pitch: 64, hand: 'right' }],
      measure: 1,
      beat: 3,
      startTime: 2,
      durationBeats: 1,
    },
  ],
};

/** Feeds a MidiEvent stream through advance(), in order, from a fresh state. */
function play(events: MidiEvent[]): EngineState {
  return events.reduce(
    (state, event) => advance(state, SCORE, event, event.time),
    createInitialState(),
  );
}

describe('advance', () => {
  it('starts waiting on the first event', () => {
    const state = createInitialState();
    expect(state.status).toBe('waiting');
    expect(state.nextEventIndex).toBe(0);
  });

  it('a perfect performance advances through every event to completion', () => {
    const result = play(generatePerfectPerformance(SCORE));
    expect(result.status).toBe('complete');
    expect(result.nextEventIndex).toBe(SCORE.events.length);
  });

  it('wrong note: a substituted pitch does not advance, and does not lose the chord notes already played', () => {
    const perfect = generatePerfectPerformance(SCORE);
    const mutated = replacePitch(perfect, 69, 71);

    const result = play(mutated);

    expect(result.status).toBe('waiting');
    expect(result.nextEventIndex).toBe(1);
    expect(result.satisfiedNoteIds).toEqual(new Set([62, 65]));
  });

  it('note early: an anticipated note inside the grace window is banked, not replayed', () => {
    const banked = shiftNoteOn(
      generatePerfectPerformance(SCORE),
      64,
      -(MS_PER_BEAT + ENGINE_TIMING.earlyNoteGraceMs),
    );

    const result = play(banked);

    expect(result.status).toBe('complete');
    expect(result.nextEventIndex).toBe(3);
  });

  it('note early: beyond the grace window it is discarded and must be replayed', () => {
    const delta = -(MS_PER_BEAT + ENGINE_TIMING.earlyNoteGraceMs + 1);
    const tooEarly = shiftNoteOn(generatePerfectPerformance(SCORE), 64, delta);

    const result = play(tooEarly);

    expect(result.status).toBe('waiting');
    expect(result.nextEventIndex).toBe(2);
    expect(result.satisfiedNoteIds.size).toBe(0);
  });

  it('note late: keeps waiting with no timeout, then advances once it finally arrives', () => {
    const perfect = generatePerfectPerformance(SCORE);

    const withDanglingNoteOff = play(dropNoteOn(perfect, 64));
    expect(withDanglingNoteOff.status).toBe('waiting');
    expect(withDanglingNoteOff.heldNotes.has(64)).toBe(false);

    expect(play(shiftNoteOn(perfect, 64, 10_000)).status).toBe('complete');
  });

  it('extra note: an unexpected note-on interleaved between real ones is ignored', () => {
    const perfect = generatePerfectPerformance(SCORE);
    const mutated = insertNote(perfect, 48, MS_PER_BEAT / 2, 100);

    const result = play(mutated);

    expect(result.status).toBe('complete');
    expect(result.nextEventIndex).toBe(SCORE.events.length);
  });

  it('missing note: a chord note that never sounds waits indefinitely, with the others still satisfied', () => {
    const perfect = generatePerfectPerformance(SCORE);
    const withoutOneNote = dropNote(perfect, 69);

    const stuck = play(withoutOneNote);
    expect(stuck.status).toBe('waiting');
    expect(stuck.nextEventIndex).toBe(1);
    expect(stuck.satisfiedNoteIds).toEqual(new Set([62, 65]));

    const completed = advance(
      stuck,
      SCORE,
      { type: 'noteOn', note: 69, velocity: 100, time: 999_999 },
      999_999,
    );
    expect(completed.nextEventIndex).toBe(2);
  });

  it('rolled chord: notes spread inside or outside the configured roll window both still complete the chord', () => {
    // Waiting never times out, so the roll window doesn't gate advancement (see
    // types.ts) — this guards against a regression that would turn it into one.
    const perfect = generatePerfectPerformance(SCORE);
    const insideWindow = shiftNoteOn(shiftNoteOn(perfect, 65, 40), 69, 80);
    const outsideWindow = shiftNoteOn(
      shiftNoteOn(perfect, 65, ENGINE_TIMING.chordRollWindowMs),
      69,
      ENGINE_TIMING.chordRollWindowMs + 100,
    );

    expect(play(insideWindow).status).toBe('complete');
    expect(play(outsideWindow).status).toBe('complete');
  });

  it('note held too long: a late note-off for the previous event does not block or corrupt the next', () => {
    const perfect = generatePerfectPerformance(SCORE);
    const mutated = shiftNoteOff(perfect, 60, 2000);

    const midway = play(mutated.filter((event) => event.time <= MS_PER_BEAT));
    expect(midway.nextEventIndex).toBe(2);
    expect(midway.heldNotes.has(60)).toBe(true);

    const result = play(mutated);
    expect(result.status).toBe('complete');
    expect(result.heldNotes.has(60)).toBe(false);
  });

  it('duplicate note-on: a repeat for an already-satisfied pitch is a no-op, not an extra note', () => {
    const upToChordNote: MidiEvent[] = [
      { type: 'noteOn', note: 60, velocity: 100, time: 0 },
      { type: 'noteOn', note: 62, velocity: 100, time: 500 },
    ];
    const duplicate: MidiEvent = { type: 'noteOn', note: 62, velocity: 100, time: 520 };

    const result = play([...upToChordNote, duplicate]);

    expect(result).toEqual(play(upToChordNote));
  });

  it('note-off with no matching note-on is ignored, with no crash and no negative artifacts', () => {
    const state = advance(
      createInitialState(),
      SCORE,
      { type: 'noteOff', note: 60, time: 0 },
      0,
    );

    expect(state.heldNotes.size).toBe(0);
    expect(state.status).toBe('waiting');
    expect(state.nextEventIndex).toBe(0);
  });

  it('chord notes in arbitrary order: only pitch-set membership matters, not the order played', () => {
    const perfect = generatePerfectPerformance(SCORE);
    const reordered = [...perfect].sort((a, b) => a.time - b.time || b.note - a.note);

    expect(play(reordered).status).toBe('complete');
  });

  it('right note wrong octave: exact MIDI pitch is compared, so it counts as a wrong note', () => {
    const perfect = generatePerfectPerformance(SCORE);
    const mutated = replacePitch(perfect, 64, 64 + 12);

    const result = play(mutated);

    expect(result.status).toBe('waiting');
    expect(result.nextEventIndex).toBe(2);
    expect(result.satisfiedNoteIds.size).toBe(0);
  });

  it('wrong note released before the correct one is played: advances normally, no residue in heldNotes', () => {
    const perfect = generatePerfectPerformance(SCORE);
    const mutated = insertNote(perfect, 48, MS_PER_BEAT - 20, 15);

    const result = play(mutated);

    expect(result.status).toBe('complete');
    expect(result.heldNotes.has(48)).toBe(false);
  });
});

describe('advance — loop wraparound (step 5)', () => {
  /**
   * Three single-measure events, the middle one a two-note chord spanning both
   * hands — enough to exercise a chord at the loop boundary without needing the
   * full three-note SCORE above.
   */
  const LOOP_SCORE: Score = {
    title: 'loop fixture',
    divisions: 4,
    timeSignatures: [{ beats: 4, beatType: 4, measure: 1 }],
    fifths: 0,
    measureCount: 3,
    events: [
      {
        id: 'm1',
        notes: [{ pitch: 60, hand: 'right' }],
        measure: 1,
        beat: 1,
        startTime: 0,
        durationBeats: 1,
      },
      {
        id: 'm2',
        notes: [
          { pitch: 62, hand: 'right' },
          { pitch: 65, hand: 'left' },
        ],
        measure: 2,
        beat: 1,
        startTime: 1,
        durationBeats: 1,
      },
      {
        id: 'm3',
        notes: [{ pitch: 67, hand: 'right' }],
        measure: 3,
        beat: 1,
        startTime: 2,
        durationBeats: 1,
      },
    ],
  };

  /** Feeds a MidiEvent stream through advance() against LOOP_SCORE, from a given state. */
  function playLoopScore(events: MidiEvent[], initial: EngineState): EngineState {
    return events.reduce(
      (state, event) => advance(state, LOOP_SCORE, event, event.time),
      initial,
    );
  }

  /** m1 as a lead-in, then m2's chord — the lap of a { startMeasure: 2, endMeasure: 2 } loop. */
  const LEAD_IN_THEN_ONE_LAP: MidiEvent[] = [
    { type: 'noteOn', note: 60, velocity: 100, time: 0 },
    { type: 'noteOff', note: 60, time: 400 },
    { type: 'noteOn', note: 62, velocity: 100, time: 500 },
    { type: 'noteOn', note: 65, velocity: 100, time: 510 },
    { type: 'noteOff', note: 62, time: 900 },
    { type: 'noteOff', note: 65, time: 900 },
  ];

  /** m1, m2, m3 in full — a straight run through the whole piece, once. */
  const WHOLE_PIECE: MidiEvent[] = [
    { type: 'noteOn', note: 60, velocity: 100, time: 0 },
    { type: 'noteOn', note: 62, velocity: 100, time: 500 },
    { type: 'noteOn', note: 65, velocity: 100, time: 510 },
    { type: 'noteOn', note: 67, velocity: 100, time: 1000 },
  ];

  it("wraps back to the loop's first event once completing the last one would move past endMeasure", () => {
    const result = playLoopScore(
      LEAD_IN_THEN_ONE_LAP,
      setLoop(createInitialState(), { startMeasure: 2, endMeasure: 2 }),
    );

    expect(result.status).toBe('waiting');
    expect(result.nextEventIndex).toBe(1); // back at m2, not m3 (index 2)
    // A fresh wait, not m2's own notes carried over from the lap that just finished.
    expect(result.satisfiedNoteIds.size).toBe(0);
    // heldNotes mirrors physical keys regardless of the index — released, so empty.
    expect(result.heldNotes.size).toBe(0);
  });

  it('loops indefinitely: a second pass through the range wraps the same way', () => {
    const firstLap = playLoopScore(
      LEAD_IN_THEN_ONE_LAP,
      setLoop(createInitialState(), { startMeasure: 2, endMeasure: 2 }),
    );
    const secondLap = playLoopScore(
      [
        { type: 'noteOn', note: 62, velocity: 100, time: 1000 },
        { type: 'noteOn', note: 65, velocity: 100, time: 1010 },
      ],
      firstLap,
    );

    expect(secondLap.status).toBe('waiting');
    expect(secondLap.nextEventIndex).toBe(1);
  });

  it('wraps rather than completing even when the loop reaches all the way to the end of the piece', () => {
    const result = playLoopScore(
      WHOLE_PIECE,
      setLoop(createInitialState(), { startMeasure: 1, endMeasure: 3 }),
    );

    expect(result.status).toBe('waiting');
    expect(result.nextEventIndex).toBe(0); // wrapped to m1, not completed
  });

  it('without a loop, the same performance completes normally at the end of the piece', () => {
    const result = playLoopScore(WHOLE_PIECE, createInitialState());

    expect(result.status).toBe('complete');
  });
});
