import { describe, expect, it } from 'vitest';

import type { Loop } from '../engine/types';
import type { MidiEvent } from '../midi/types';
import type { Score, ScoreEvent } from '../score/types';
import {
  advancePracticeView,
  createInitialPracticeViewState,
  setPracticeLoop,
  type PracticeViewState,
} from './practiceView';
import { expireDueEvents, type Timing } from './timedPlay';

function event(measure: number, startTime: number, pitches: number[]): ScoreEvent {
  return {
    id: `e${startTime}`,
    notes: pitches.map((pitch) => ({ pitch, hand: 'right' as const })),
    measure,
    beat: 1,
    startTime,
    durationBeats: 1,
  };
}

/**
 * Three bars with no time signature, so 4/4: quarters in m1, a chord and a half note in
 * m2, and one whole note in m3.
 */
const SCORE: Score = {
  title: 'fixture',
  divisions: 1,
  timeSignatures: [],
  fifths: 0,
  measureCount: 3,
  events: [
    event(1, 0, [60]), // C4
    event(1, 1, [62]), // D4
    event(1, 2, [64]), // E4
    event(1, 3, [65]), // F4
    event(2, 4, [67, 48]), // G4 and C3
    event(2, 6, [69]), // A4
    event(3, 8, [71]), // B4
  ],
};

/** 60 beats a minute, so an event's due time is its startTime in seconds. */
const TIMING: Timing = { msPerBeat: 1000, grid: null };

/** C4, the first note, at 5 s: every later event falls due at 5 s + its startTime. */
const START = 5000;

const on = (note: number, time: number): MidiEvent => ({
  type: 'noteOn',
  note,
  velocity: 100,
  time,
});

function play(
  events: MidiEvent[],
  state: PracticeViewState = createInitialPracticeViewState(),
  timing: Timing | null = TIMING,
): PracticeViewState {
  return events.reduce(
    (next, midiEvent) =>
      advancePracticeView(next, SCORE, midiEvent, midiEvent.time, timing),
    state,
  );
}

/** A clock started by C4 at START, the engine waiting on D4. */
const started = () => play([on(60, START)]);

const looped = (loop: Loop) => setPracticeLoop(createInitialPracticeViewState(), loop);

describe('starting the clock', () => {
  it('starts at the event the first note completes, at the note’s own time, untimed itself', () => {
    const state = play([on(60, START)]);

    expect(state.timedClock).toEqual({
      startedAt: START,
      startTime: 0,
      msPerBeat: 1000,
      passBeats: 0,
      lastNoteAt: START,
    });
    expect(state.engine.nextEventIndex).toBe(1);
    expect(state.attempt).toMatchObject({ notesPlayed: 1, hitNoteCount: 0 });
  });

  it('snaps onto the nearest click of the metronome’s grid', () => {
    const grid = { origin: 4700, msPerBeat: 1000 };

    expect(
      play([on(60, START)], undefined, { ...TIMING, grid }).timedClock,
    ).toMatchObject({
      startedAt: 4700,
      lastNoteAt: START,
    });
    expect(
      play([on(60, 5400)], undefined, { ...TIMING, grid }).timedClock?.startedAt,
    ).toBe(5700);
  });

  it('snaps an off-beat event to the same fraction of a beat after a click', () => {
    const offBeat: Score = {
      ...SCORE,
      events: [event(1, 0.5, [60]), event(1, 1.5, [62])],
    };
    const timing = { ...TIMING, grid: { origin: 4000, msPerBeat: 1000 } };

    const state = advancePracticeView(
      createInitialPracticeViewState(),
      offBeat,
      on(60, 5100),
      5100,
      timing,
    );

    // 4500 and 5500 put beat position 0.5 on the grid; 5500 is the nearer.
    expect(state.timedClock?.startedAt).toBe(5500);
  });

  it('does not start in wait-mode', () => {
    expect(play([on(60, START)], undefined, null).timedClock).toBeUndefined();
  });

  it('does not start on a wrong note, or on a chord only partly played', () => {
    const wrong = play([on(61, START)]);
    expect(wrong.timedClock).toBeUndefined();

    const reachedChord = play(
      [on(60, 0), on(62, 1), on(64, 2), on(65, 3)],
      undefined,
      null,
    );
    expect(play([on(67, START)], reachedChord).timedClock).toBeUndefined();
    expect(play([on(67, START), on(48, START)], reachedChord).timedClock).toMatchObject({
      startTime: 4,
    });
  });

  it('with a loop set, starts only on an event inside it', () => {
    const beforeLoop = play(
      [on(60, 0), on(62, 1), on(64, 2), on(65, 3)],
      looped({
        startMeasure: 2,
        endMeasure: 2,
      }),
    );
    // F4 completed m1 and moved the engine into the loop, but was played outside it.
    expect(beforeLoop.timedClock).toBeUndefined();
    expect(beforeLoop.engine.nextEventIndex).toBe(4);

    expect(play([on(67, START), on(48, START)], beforeLoop).timedClock).toMatchObject({
      startTime: 4,
    });
  });

  it('with a loop set late, starts on the loop’s own event, not the one past its end', () => {
    const atA4 = play(
      [on(60, 0), on(62, 1), on(64, 2), on(65, 3), on(67, 4), on(48, 4)],
      undefined,
      null,
    );
    const pastEnd = play(
      [on(69, START)],
      setPracticeLoop(atA4, { startMeasure: 1, endMeasure: 1 }),
    );

    // Played as in wait-mode, wrapping into the loop.
    expect(pastEnd.timedClock).toBeUndefined();
    expect(pastEnd.engine.nextEventIndex).toBe(0);
    expect(play([on(60, START)], pastEnd).timedClock).toMatchObject({ startTime: 0 });
  });

  it('counts a whole pass when the first note completes the loop’s last event', () => {
    const atF4 = play(
      [on(60, 0), on(62, 1), on(64, 2)],
      looped({ startMeasure: 1, endMeasure: 1 }),
      null,
    );

    const state = play([on(65, START)], atF4);

    // F4 at 5 s puts the next pass's C4 at 6 s, not 2 s.
    expect(state.timedClock).toMatchObject({ startTime: 3, passBeats: 4 });
    expect(play([on(60, START + 1000)], state).attempt.hitOffsetBeats).toBe(0);
  });
});

describe('judging a note while the clock runs', () => {
  it('scores a hit inside the window with its signed and absolute offset', () => {
    const state = play([on(62, 6100), on(64, 6900)], started());

    expect(state.engine.nextEventIndex).toBe(3);
    expect(state.attempt).toMatchObject({ notesPlayed: 3, hitNoteCount: 2 });
    expect(state.attempt.hitOffsetBeats).toBeCloseTo(0);
    expect(state.attempt.hitAbsOffsetBeats).toBeCloseTo(0.2);
  });

  it('opens the window a quarter beat early', () => {
    expect(play([on(62, 5749)], started()).attempt.hitNoteCount).toBe(0);
    expect(play([on(62, 5750)], started()).attempt.hitNoteCount).toBe(1);
  });

  it('marks off-time, red and not wrong: early, a repeat, and either neighbour’s pitch', () => {
    const early = play([on(62, 5600)], started());
    const previous = play([on(60, 6000)], started());
    const next = play([on(64, 6000)], started());
    // G4 of the m2 chord hit, then played again while C3 is still to come.
    const repeat = play(
      [on(62, 6000), on(64, 7000), on(65, 8000), on(67, 9000), on(67, 9100)],
      started(),
    );

    for (const [state, pitch] of [
      [early, 62],
      [previous, 60],
      [next, 64],
      [repeat, 67],
    ] as const) {
      expect(state.attempt).toMatchObject({ offTimeNoteCount: 1, wrongNoteCount: 0 });
      expect(state.wrongNotes.has(pitch)).toBe(true);
    }
    expect(early.engine.nextEventIndex).toBe(1);
    expect(repeat.engine.nextEventIndex).toBe(4);
  });

  it('marks anything else wrong', () => {
    const state = play([on(71, 6000)], started());

    expect(state.attempt).toMatchObject({
      notesPlayed: 2,
      wrongNoteCount: 1,
      offTimeNoteCount: 0,
    });
  });

  it('judges a late note after the miss: one missed, one off-time', () => {
    // D4's window closed at 6250; E4, now current, is not due until 7000.
    const state = play([on(62, 6300)], started());

    expect(state.engine.nextEventIndex).toBe(2);
    expect(state.attempt).toMatchObject({ missedNoteCount: 1, offTimeNoteCount: 1 });
  });

  it('sets reachedEnd when the player’s note completes the last event, and stops', () => {
    const state = play(
      [
        on(62, 6000),
        on(64, 7000),
        on(65, 8000),
        on(67, 9000),
        on(48, 9000),
        on(69, 11000),
        on(71, 13000),
      ],
      started(),
    );

    expect(state.engine.status).toBe('complete');
    expect(state.timedClock).toBeUndefined();
    expect(state.attempt).toMatchObject({
      notesPlayed: 8,
      hitNoteCount: 7,
      missedNoteCount: 0,
      reachedEnd: true,
    });
  });
});

describe('expireDueEvents', () => {
  it('misses the unplayed pitches of each closed event, in order', () => {
    const state = expireDueEvents(started(), SCORE, 8250); // F4's window closes at 8250

    expect(state.engine.nextEventIndex).toBe(4);
    expect(state.attempt.missedNoteCount).toBe(3);
  });

  it('counts only the pitches of a chord not yet hit', () => {
    const atChord = play(
      [on(62, 6000), on(64, 7000), on(65, 8000), on(67, 9000)],
      started(),
    );

    const state = expireDueEvents(atChord, SCORE, 9250);

    expect(state.engine.nextEventIndex).toBe(5);
    expect(state.engine.satisfiedNoteIds.size).toBe(0);
    expect(state.attempt.missedNoteCount).toBe(1); // C3
  });

  it('returns the state itself while the current window is open, or with no clock', () => {
    const running = started();
    expect(expireDueEvents(running, SCORE, 6249)).toBe(running);

    const untimed = createInitialPracticeViewState();
    expect(expireDueEvents(untimed, SCORE, 1e9)).toBe(untimed);
  });

  it('stops the clock with reachedEnd false when the last event is missed', () => {
    const state = expireDueEvents(started(), SCORE, 1e9);

    expect(state.engine.status).toBe('complete');
    expect(state.timedClock).toBeUndefined();
    expect(state.attempt).toMatchObject({ missedNoteCount: 7, reachedEnd: false });
  });
});

describe('a loop', () => {
  const loopedM1 = () =>
    play([on(60, START)], looped({ startMeasure: 1, endMeasure: 1 }));

  it('runs on at tempo through the wrap, one loop length on', () => {
    const state = play([on(62, 6000), on(64, 7000), on(65, 8000)], loopedM1());

    expect(state.engine.nextEventIndex).toBe(0);
    expect(state.timedClock?.passBeats).toBe(4);
    // C4's next pass is due at 9 s.
    expect(play([on(60, 9000)], state).attempt).toMatchObject({
      hitNoteCount: 4,
      hitOffsetBeats: 0,
    });
  });

  it('stops the clock when changed', () => {
    const state = setPracticeLoop(loopedM1(), { startMeasure: 1, endMeasure: 2 });

    expect(state.timedClock).toBeUndefined();
    expect(state.engine.nextEventIndex).toBe(1);
  });

  it('pauses after one whole silent pass, and the next right note starts again', () => {
    // C4 of the next pass closes at 9250, a loop's length and more after the last note.
    const paused = expireDueEvents(loopedM1(), SCORE, 20_000);

    expect(paused.timedClock).toBeUndefined();
    expect(paused.attempt.missedNoteCount).toBe(4);
    expect(paused.engine.nextEventIndex).toBe(1);

    expect(play([on(62, 30_000)], paused).timedClock).toMatchObject({
      startedAt: 30_000,
      startTime: 1,
    });
  });

  it('does not pause a one-event loop played a little late each pass', () => {
    const atB4 = play(
      [on(60, 0), on(62, 1), on(64, 2), on(65, 3), on(67, 4), on(48, 4), on(69, 6)],
      undefined,
      null,
    );
    const lateEachPass = [on(71, START), on(71, 9100), on(71, 13100), on(71, 17100)];

    const state = play(
      lateEachPass,
      setPracticeLoop(atB4, { startMeasure: 3, endMeasure: 3 }),
    );

    // The first note wrapped the loop too: four passes on.
    expect(state.timedClock).toMatchObject({ passBeats: 16 });
    expect(state.attempt).toMatchObject({ hitNoteCount: 3, missedNoteCount: 0 });
  });
});
