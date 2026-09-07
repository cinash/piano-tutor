import { advance, createInitialState } from '../engine/advance';
import type { EngineState } from '../engine/types';
import type { MidiEvent } from '../midi/types';
import type { Score } from '../score/types';

export interface PracticeViewState {
  engine: EngineState;
  wrongNotes: ReadonlySet<number>;
}

export function createInitialPracticeViewState(): PracticeViewState {
  return { engine: createInitialState(), wrongNotes: new Set() };
}

/**
 * advance() has no "wrong" status of its own (see DECISIONS.md) — a wrong note simply
 * doesn't change what it's waiting for. The falling-note view still needs one for
 * display, so this tracks it separately: a pitch is wrong if, at the moment it
 * sounded, it matched neither the event advance() was waiting for nor the one it
 * credits early (src/engine/advance.ts) — checked against the state *before* advance()
 * runs, not against the accumulated heldNotes afterwards. A correctly-played note is
 * routinely still held once the engine has advanced past it (e.g. a sustained chord
 * under a moving melody line), and re-testing heldNotes against the new current/next
 * pitches would wrongly flag it the moment the engine moves on.
 */
export function advancePracticeView(
  state: PracticeViewState,
  score: Score,
  event: MidiEvent,
  clock: number,
): PracticeViewState {
  const wrongNotes = new Set(state.wrongNotes);

  if (event.type === 'noteOff') {
    wrongNotes.delete(event.note);
  } else {
    const expected = score.events[state.engine.nextEventIndex]?.notes ?? [];
    const upNext = score.events[state.engine.nextEventIndex + 1]?.notes ?? [];
    const isExpected =
      expected.some((note) => note.pitch === event.note) ||
      upNext.some((note) => note.pitch === event.note);
    if (!isExpected) wrongNotes.add(event.note);
  }

  return { engine: advance(state.engine, score, event, clock), wrongNotes };
}
