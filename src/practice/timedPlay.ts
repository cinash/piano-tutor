import { nextIndexAfter } from '../engine/advance';
import type { Loop } from '../engine/types';
import type { MidiEvent } from '../midi/types';
import { measureStartTime } from '../score/measureStartTime';
import type { Score, ScoreEvent } from '../score/types';
import type { AttemptStats, PracticeViewState } from './practiceView';

/**
 * How far either side of its due time a note is still in time, in quarter-note beats:
 * a slower speed is also more forgiving, and for eighths and longer one event's window
 * closes where the next one's opens — see DECISIONS.md.
 */
export const TIMED_WINDOW = 0.25;

/** What timed play needs to know of the speed chosen; the reducers take null in wait-mode. */
export interface Timing {
  msPerBeat: number;
}

/** A running timed attempt: the fixed clock every event's due time is read from. */
export interface TimedClock {
  startedAt: number; // performance.now() time at which score position `startTime` fell due
  startTime: number; // quarter-note beats
  msPerBeat: number;
  passBeats: number; // loop length × passes completed; 0 without a loop
  lastNoteAt: number; // performance.now() time of the last note-on, for the loop's pause
}

/** From the start of the loop's first bar to the end of its last, in quarter-note beats. */
function loopLengthBeats(score: Score, loop: Loop): number {
  return (
    measureStartTime(score, loop.endMeasure + 1) -
    measureStartTime(score, loop.startMeasure)
  );
}

function isInLoop(event: ScoreEvent, loop: Loop | undefined): boolean {
  return (
    !loop || (event.measure >= loop.startMeasure && event.measure <= loop.endMeasure)
  );
}

/** A move from `from` to `to` that went backwards wrapped the loop: one pass more. */
function wrapBeats(score: Score, loop: Loop | undefined, from: number, to: number) {
  return loop && to <= from ? loopLengthBeats(score, loop) : 0;
}

const dueTime = (clock: TimedClock, event: ScoreEvent) =>
  clock.startedAt +
  (event.startTime + clock.passBeats - clock.startTime) * clock.msPerBeat;

const closeTime = (clock: TimedClock, event: ScoreEvent) =>
  dueTime(clock, event) + TIMED_WINDOW * clock.msPerBeat;

/**
 * A note judged in wait-mode, from `before` to `after`, starts the clock when it completed
 * an event — at that event, and at `now`, the note's time. With a loop, only the loop is
 * timed: the bars before it, and an event past its end when the loop was set late, stay
 * in wait-mode. The first note is not itself timed.
 */
export function startClock(
  before: PracticeViewState,
  after: PracticeViewState,
  score: Score,
  event: MidiEvent,
  now: number,
  timing: Timing,
): PracticeViewState {
  const { engine } = before;
  const current = score.events[engine.nextEventIndex];
  const completesCurrent =
    event.type === 'noteOn' &&
    engine.status === 'waiting' &&
    current.notes.every(
      (note) => note.pitch === event.note || engine.satisfiedNoteIds.has(note.pitch),
    );
  if (
    !completesCurrent ||
    !isInLoop(current, engine.loop) ||
    after.engine.status === 'complete'
  ) {
    return after;
  }

  // Clock and note on one timeline: MidiEvent.time is performance.now(), from the piano
  // and the computer keyboard both. Not from a replay, which re-emits the times it was
  // recorded with, so every window would close at once — see DECISIONS.md.
  return {
    ...after,
    timedClock: {
      startedAt: now,
      startTime: current.startTime,
      msPerBeat: timing.msPerBeat,
      passBeats: wrapBeats(
        score,
        engine.loop,
        engine.nextEventIndex,
        after.engine.nextEventIndex,
      ),
      lastNoteAt: now,
    },
  };
}

/** When the event the engine is on stops being playable in time; null with no clock. */
export function currentCloseTime(state: PracticeViewState, score: Score): number | null {
  return state.timedClock
    ? closeTime(state.timedClock, score.events[state.engine.nextEventIndex])
    : null;
}

/** On to the next event, one pass on at a loop's wrap; the last one stops the clock. */
function moveOn(
  state: PracticeViewState,
  clock: TimedClock,
  score: Score,
): PracticeViewState {
  const { engine } = state;
  const nextEventIndex = nextIndexAfter(engine, score);
  const satisfiedNoteIds = new Set<number>();

  if (!score.events[nextEventIndex]) {
    return {
      ...state,
      engine: { ...engine, nextEventIndex, satisfiedNoteIds, status: 'complete' },
      timedClock: undefined,
    };
  }

  const passBeats =
    clock.passBeats +
    wrapBeats(score, engine.loop, engine.nextEventIndex, nextEventIndex);
  return {
    ...state,
    engine: { ...engine, nextEventIndex, satisfiedNoteIds },
    timedClock: { ...clock, passBeats },
  };
}

/**
 * Every event whose window has closed by `now` is missed, in order. No clock: unchanged.
 * With a loop, a miss closing a whole loop's length after the last note stops the clock —
 * here, never on a note's arrival, where a one-event loop's gap between two right notes
 * is a loop's length. Measured at the miss rather than at `now`, so a late call still
 * counts the whole silent pass.
 */
export function expireDueEvents(
  state: PracticeViewState,
  score: Score,
  now: number,
): PracticeViewState {
  let next = state;
  while (next.timedClock) {
    const { engine, timedClock, attempt } = next;
    const current = score.events[engine.nextEventIndex];
    const close = closeTime(timedClock, current);
    if (now < close) break;

    const missed = current.notes.filter(
      (note) => !engine.satisfiedNoteIds.has(note.pitch),
    ).length;
    next = moveOn(
      {
        ...next,
        attempt: { ...attempt, missedNoteCount: attempt.missedNoteCount + missed },
      },
      timedClock,
      score,
    );

    const silentPass =
      engine.loop &&
      close - timedClock.lastNoteAt >=
        loopLengthBeats(score, engine.loop) * timedClock.msPerBeat;
    if (silentPass) next = { ...next, timedClock: undefined };
  }
  return next;
}

const hasPitch = (event: ScoreEvent | undefined, pitch: number) =>
  event?.notes.some((note) => note.pitch === pitch) ?? false;

const withHit = (attempt: AttemptStats, offset: number): AttemptStats => ({
  ...attempt,
  hitNoteCount: attempt.hitNoteCount + 1,
  hitOffsetBeats: attempt.hitOffsetBeats + offset,
  hitAbsOffsetBeats: attempt.hitAbsOffsetBeats + Math.abs(offset),
});

/**
 * A note-on while the clock runs, after expireDueEvents: a pitch of the current event inside
 * its window is a hit; one before its window or already hit, or a pitch of the event
 * either side, is off-time — red, played, not wrong; anything else is wrong.
 */
export function judgeTimedNote(
  state: PracticeViewState,
  clock: TimedClock,
  score: Score,
  event: MidiEvent,
  now: number,
): PracticeViewState {
  const heldNotes = new Set(state.engine.heldNotes).add(event.note);
  const { nextEventIndex, satisfiedNoteIds } = state.engine;
  const current = score.events[nextEventIndex];
  const offset = (now - dueTime(clock, current)) / clock.msPerBeat;
  const timedClock = { ...clock, lastNoteAt: now };
  const attempt = { ...state.attempt, notesPlayed: state.attempt.notesPlayed + 1 };

  const isHit =
    hasPitch(current, event.note) &&
    !satisfiedNoteIds.has(event.note) &&
    offset >= -TIMED_WINDOW;
  if (isHit) {
    const satisfied = new Set(satisfiedNoteIds).add(event.note);
    const hit: PracticeViewState = {
      ...state,
      engine: { ...state.engine, heldNotes, satisfiedNoteIds: satisfied },
      attempt: withHit(attempt, offset),
      timedClock,
    };
    if (!current.notes.every((note) => satisfied.has(note.pitch))) return hit;

    const next = moveOn(hit, timedClock, score);
    // The player's own note finished the piece; a clock that carries it there does not.
    return next.engine.status === 'complete'
      ? { ...next, attempt: { ...next.attempt, reachedEnd: true } }
      : next;
  }

  // Deliberately linear, not loop-aware, as wait-mode's "next event" rule is.
  const isOffTime =
    hasPitch(current, event.note) ||
    hasPitch(score.events[nextEventIndex - 1], event.note) ||
    hasPitch(score.events[nextEventIndex + 1], event.note);
  return {
    ...state,
    engine: { ...state.engine, heldNotes },
    wrongNotes: new Set(state.wrongNotes).add(event.note),
    attempt: isOffTime
      ? { ...attempt, offTimeNoteCount: attempt.offTimeNoteCount + 1 }
      : { ...attempt, wrongNoteCount: attempt.wrongNoteCount + 1 },
    timedClock,
  };
}
