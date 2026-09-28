import { advance, createInitialState, setLoop } from '../engine/advance';
import type { EngineState, Loop } from '../engine/types';
import type { MidiEvent } from '../midi/types';
import type { Note, Score } from '../score/types';
import {
  expireDueEvents,
  judgeTimedNote,
  startClock,
  type TimedClock,
  type Timing,
} from './timedPlay';

/**
 * The notes of one event, and an empty list for an index past the last event — which is
 * what the completed state looks like, not a separate case.
 */
export const notesAt = (score: Score, index: number): readonly Note[] =>
  score.events[index]?.notes ?? [];

/**
 * What one run through the piece — one restart to the next — contained. The timed
 * counters stay zero in wait-mode.
 */
export interface AttemptStats {
  notesPlayed: number;
  wrongNoteCount: number;
  reachedEnd: boolean; // the player's own note completed the last event
  missedNoteCount: number;
  offTimeNoteCount: number;
  hitNoteCount: number;
  hitOffsetBeats: number; // signed sum: ÷ hitNoteCount is early (−) or late (+) on average
  hitAbsOffsetBeats: number; // sum of distances: ÷ hitNoteCount is how tight
}

export interface PracticeViewState {
  engine: EngineState;
  wrongNotes: ReadonlySet<number>;
  attempt: AttemptStats;
  // Here rather than in App, so every path that resets practice stops it.
  timedClock?: TimedClock;
}

export function createInitialPracticeViewState(): PracticeViewState {
  return {
    engine: createInitialState(),
    wrongNotes: new Set(),
    attempt: {
      notesPlayed: 0,
      wrongNoteCount: 0,
      reachedEnd: false,
      missedNoteCount: 0,
      offTimeNoteCount: 0,
      hitNoteCount: 0,
      hitOffsetBeats: 0,
      hitAbsOffsetBeats: 0,
    },
  };
}

export function setPracticeLoop(
  state: PracticeViewState,
  loop: Loop | undefined,
): PracticeViewState {
  // A new loop stops the clock; the next right note inside it starts another.
  return { ...state, engine: setLoop(state.engine, loop), timedClock: undefined };
}

/**
 * Stops a timed clock, and returns the state itself when none is running, so Listen in
 * wait-mode does not re-run App's attempt effect and move the open record's `endedAt`.
 */
export function stopClock(state: PracticeViewState): PracticeViewState {
  return state.timedClock ? { ...state, timedClock: undefined } : state;
}

/** Starts the piece again, keeping the loop range — see DECISIONS.md. */
export function restartPractice(state: PracticeViewState): PracticeViewState {
  return setPracticeLoop(createInitialPracticeViewState(), state.engine.loop);
}

/**
 * One note, or a release. While a timed clock runs the timed rules judge a note; a
 * release, and any note with no clock, go to wait-mode, and in timed mode (`timing` not
 * null) a note completing an event starts the clock there.
 */
export function advancePracticeView(
  state: PracticeViewState,
  score: Score,
  event: MidiEvent,
  clock: number,
  timing: Timing | null,
): PracticeViewState {
  const expired = expireDueEvents(state, score, clock);
  if (expired.timedClock && event.type === 'noteOn') {
    return judgeTimedNote(expired, expired.timedClock, score, event, clock);
  }

  const next = advanceWaitMode(expired, score, event, clock);
  return timing ? startClock(expired, next, score, event, clock, timing) : next;
}

/**
 * A pitch is wrong if, when it sounds, it matches neither the event advance() is
 * waiting for nor the one after — checked against the state *before* advance() runs,
 * not against the accumulated heldNotes afterwards. See DECISIONS.md for why (a
 * sustained correct note must not be flagged once the engine has advanced past it).
 */
function advanceWaitMode(
  state: PracticeViewState,
  score: Score,
  event: MidiEvent,
  clock: number,
): PracticeViewState {
  const wrongNotes = new Set(state.wrongNotes);
  let attempt = state.attempt;
  const engine = advance(state.engine, score, event, clock);

  if (event.type === 'noteOff') {
    wrongNotes.delete(event.note);
  } else if (state.engine.status === 'waiting') {
    const expected = notesAt(score, state.engine.nextEventIndex);
    // Deliberately linear, not loop-aware — see DECISIONS.md.
    const upNext = notesAt(score, state.engine.nextEventIndex + 1);
    const isExpected =
      expected.some((note) => note.pitch === event.note) ||
      upNext.some((note) => note.pitch === event.note);
    if (!isExpected) wrongNotes.add(event.note);
    attempt = {
      ...attempt,
      notesPlayed: attempt.notesPlayed + 1,
      wrongNoteCount: attempt.wrongNoteCount + (isExpected ? 0 : 1),
      reachedEnd: engine.status === 'complete',
    };
  }

  return { ...state, engine, wrongNotes, attempt };
}
