import type { Score } from '../score/types';
import type { MidiEvent } from '../midi/types';
import { ENGINE_TIMING, type EngineState } from './types';

/** A fresh EngineState for the start of a piece (or a loop's first event). */
export function createInitialState(): EngineState {
  return {
    status: 'waiting',
    nextEventIndex: 0,
    satisfiedNoteIds: new Set(),
    heldNotes: new Set(),
    pendingEarlyNotes: new Map(),
  };
}

export function advance(
  state: EngineState,
  score: Score,
  event: MidiEvent,
  clock: number,
): EngineState {
  const heldNotes = new Set(state.heldNotes);
  if (event.type === 'noteOn') heldNotes.add(event.note);
  else heldNotes.delete(event.note);

  if (state.status === 'complete' || event.type === 'noteOff') {
    return { ...state, heldNotes };
  }

  const expectedPitches = score.events[state.nextEventIndex].notes.map(
    (note) => note.pitch,
  );

  if (!expectedPitches.includes(event.note)) {
    const nextExpectedPitches = score.events[state.nextEventIndex + 1]?.notes.map(
      (note) => note.pitch,
    );
    if (!nextExpectedPitches?.includes(event.note)) {
      return { ...state, heldNotes };
    }
    const pendingEarlyNotes = new Map(state.pendingEarlyNotes).set(event.note, clock);
    return { ...state, heldNotes, pendingEarlyNotes };
  }

  const satisfiedNoteIds = new Set(state.satisfiedNoteIds).add(event.note);
  if (!expectedPitches.every((pitch) => satisfiedNoteIds.has(pitch))) {
    return { ...state, heldNotes, satisfiedNoteIds };
  }

  return completeCurrentEvent({ ...state, heldNotes, satisfiedNoteIds }, score, clock);
}

/**
 * The current event's chord is fully satisfied — move to the next one, crediting
 * any of its notes that were already played early enough. Recurses because those
 * credited notes can themselves complete the new current event outright.
 */
function completeCurrentEvent(
  state: EngineState,
  score: Score,
  clock: number,
): EngineState {
  const nextEventIndex = state.nextEventIndex + 1;
  const nextEvent = score.events[nextEventIndex];

  if (!nextEvent) {
    return {
      ...state,
      satisfiedNoteIds: new Set(),
      pendingEarlyNotes: new Map(),
      nextEventIndex,
      status: 'complete',
    };
  }

  const expectedPitches = nextEvent.notes.map((note) => note.pitch);
  const satisfiedNoteIds = new Set(
    expectedPitches.filter((pitch) => {
      const earlyAt = state.pendingEarlyNotes.get(pitch);
      return earlyAt !== undefined && clock - earlyAt <= ENGINE_TIMING.earlyNoteGraceMs;
    }),
  );

  const advanced: EngineState = {
    ...state,
    satisfiedNoteIds,
    pendingEarlyNotes: new Map(),
    nextEventIndex,
  };

  return expectedPitches.every((pitch) => satisfiedNoteIds.has(pitch))
    ? completeCurrentEvent(advanced, score, clock)
    : advanced;
}
