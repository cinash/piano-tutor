import { nextIndexAfter } from '../engine/advance';
import type { Loop } from '../engine/types';
import type { MidiEvent } from '../midi/types';
import { measureStartTime } from '../score/measureStartTime';
import type { Score, ScoreEvent } from '../score/types';
import { DEMO_BPM } from './demo';
import type { Grid } from './metronome';
import type { AttemptStats, PracticeViewState } from './practiceView';

/**
 * How far either side of its due time a note is still in time, in quarter-note beats:
 * a slower speed is also more forgiving, and for eighths and longer one event's window
 * closes where the next one's opens — see DECISIONS.md.
 */
export const TIMED_WINDOW = 0.25;

/**
 * What timed play needs to know of the speed chosen, and the metronome's grid, null with
 * it off; the reducers take null in wait-mode.
 */
export interface Timing {
  msPerBeat: number;
  grid: Grid | null;
}

/** The length of a quarter-note beat at a speed preset's fraction of DEMO_BPM. */
export const msPerBeatAt = (speed: number) => 60000 / (DEMO_BPM * speed);

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
 * an event — at that event, and at the note's time `now`, snapped onto the metronome's
 * grid when there is one. With a loop, only the loop is
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
      startedAt: timing.grid ? snapToGrid(timing.grid, current.startTime, now) : now,
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

/**
 * Of the times at which the grid puts beat position `startTime` — a click, for an event
 * on the beat, or the same fraction of a beat after one — the nearest to `now`.
 */
function snapToGrid({ origin, msPerBeat }: Grid, startTime: number, now: number) {
  const fraction = startTime - Math.floor(startTime);
  const beat = Math.round((now - origin) / msPerBeat - fraction);
  return origin + (beat + fraction) * msPerBeat;
}

/**
 * When the clock next changes what the screen shows or what is missed: the next event's
 * due time, where the cursor moves on, or the current event's close, whichever comes
 * first. Null with no clock.
 */
export function nextClockTime(
  state: PracticeViewState,
  score: Score,
  now: number,
): number | null {
  const { timedClock, engine } = state;
  if (!timedClock) return null;
  const close = closeTime(timedClock, score.events[engine.nextEventIndex]);
  return Math.min(close, nextDueTime(score, timedClock, engine.loop, now) ?? Infinity);
}

/** The clock's score position at `now`, in unfolded beats: never before its start. */
const beatsAt = (clock: TimedClock, now: number) =>
  clock.startTime + Math.max(0, (now - clock.startedAt) / clock.msPerBeat);

/** A position folded into the loop, whose passes repeat it; unchanged with none. */
function foldIntoLoop(score: Score, loop: Loop | undefined, beats: number): number {
  if (!loop) return beats;
  const loopStartTime = measureStartTime(score, loop.startMeasure);
  return loopStartTime + ((beats - loopStartTime) % loopLengthBeats(score, loop));
}

/**
 * The startTime of the last event whose time has come by `now`, as the score position:
 * where the music is, for the staff cursor. Before the clock's start, its own startTime;
 * in a loop bar that opens with a rest, the loop's first event's.
 */
export function clockPosition(
  score: Score,
  clock: TimedClock,
  loop: Loop | undefined,
  now: number,
): number {
  const position = foldIntoLoop(score, loop, beatsAt(clock, now));
  const events = score.events.filter((event) => isInLoop(event, loop));
  return (
    events.filter((event) => event.startTime <= position).at(-1)?.startTime ??
    events[0].startTime
  );
}

/** When the next event after `now` falls due, round the loop if need be; null past the last. */
function nextDueTime(
  score: Score,
  clock: TimedClock,
  loop: Loop | undefined,
  now: number,
): number | null {
  const beats = beatsAt(clock, now);
  const position = foldIntoLoop(score, loop, beats);
  const events = score.events.filter((event) => isInLoop(event, loop));
  const next = events.find((event) => event.startTime > position);
  let beatsAhead: number;
  if (next) beatsAhead = next.startTime - position;
  // Past the loop's last event: on to its first, one pass later.
  else if (loop)
    beatsAhead = loopLengthBeats(score, loop) - (position - events[0].startTime);
  else return null;
  return clock.startedAt + (beats + beatsAhead - clock.startTime) * clock.msPerBeat;
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
