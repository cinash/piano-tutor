import { advance, createInitialState, setLoop } from '../engine/advance';
import type { EngineState, Loop } from '../engine/types';
import type { MidiEvent } from '../midi/types';
import type { Note, Score } from '../score/types';

/**
 * The notes of one event, and an empty list for an index past the last event — which is
 * what the completed state looks like, not a separate case.
 */
export const notesAt = (score: Score, index: number): readonly Note[] =>
  score.events[index]?.notes ?? [];

/** What one run through the piece — one restart to the next — contained. */
export interface AttemptStats {
  notesPlayed: number;
  wrongNoteCount: number;
}

export interface PracticeViewState {
  engine: EngineState;
  wrongNotes: ReadonlySet<number>;
  attempt: AttemptStats;
}

export function createInitialPracticeViewState(): PracticeViewState {
  return {
    engine: createInitialState(),
    wrongNotes: new Set(),
    attempt: { notesPlayed: 0, wrongNoteCount: 0 },
  };
}

export function setPracticeLoop(
  state: PracticeViewState,
  loop: Loop | undefined,
): PracticeViewState {
  return { ...state, engine: setLoop(state.engine, loop) };
}

/** Starts the piece again, keeping the loop range — see DECISIONS.md. */
export function restartPractice(state: PracticeViewState): PracticeViewState {
  return setPracticeLoop(createInitialPracticeViewState(), state.engine.loop);
}

/**
 * A pitch is wrong if, when it sounds, it matches neither the event advance() is
 * waiting for nor the one after — checked against the state *before* advance() runs,
 * not against the accumulated heldNotes afterwards. See DECISIONS.md for why (a
 * sustained correct note must not be flagged once the engine has advanced past it).
 */
export function advancePracticeView(
  state: PracticeViewState,
  score: Score,
  event: MidiEvent,
  clock: number,
): PracticeViewState {
  const wrongNotes = new Set(state.wrongNotes);
  let attempt = state.attempt;

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
      notesPlayed: attempt.notesPlayed + 1,
      wrongNoteCount: attempt.wrongNoteCount + (isExpected ? 0 : 1),
    };
  }

  return { engine: advance(state.engine, score, event, clock), wrongNotes, attempt };
}
