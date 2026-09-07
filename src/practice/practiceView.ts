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

  if (event.type === 'noteOff') {
    wrongNotes.delete(event.note);
  } else if (state.engine.status === 'waiting') {
    const expected = score.events[state.engine.nextEventIndex]?.notes ?? [];
    const upNext = score.events[state.engine.nextEventIndex + 1]?.notes ?? [];
    const isExpected =
      expected.some((note) => note.pitch === event.note) ||
      upNext.some((note) => note.pitch === event.note);
    if (!isExpected) wrongNotes.add(event.note);
  }

  return { engine: advance(state.engine, score, event, clock), wrongNotes };
}
