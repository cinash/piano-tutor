import type { Score } from '../score/types';
import type { MidiEvent } from '../midi/types';
import { ENGINE_TIMING, type EngineState, type Loop } from './types';

/** A fresh EngineState for the start of a piece. */
export function createInitialState(): EngineState {
  return {
    status: 'waiting',
    nextEventIndex: 0,
    satisfiedNoteIds: new Set(),
    heldNotes: new Set(),
    pendingEarlyNotes: new Map(),
  };
}

/** Sets or clears the loop range without otherwise touching playback. */
export function setLoop(state: EngineState, loop: Loop | undefined): EngineState {
  return { ...state, loop };
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
    // Deliberately linear, not loop-aware — see DECISIONS.md.
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
  const nextEventIndex = nextIndexAfter(state, score);
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

/**
 * Where the just-completed event's chord sends us next: linearly forward, unless a
 * loop is set and that would move past its end measure — then wrap back to the
 * loop's first event instead, including when the linear move would otherwise have
 * reached the end of the piece.
 */
function nextIndexAfter({ nextEventIndex, loop }: EngineState, score: Score): number {
  const linearIndex = nextEventIndex + 1;
  const linearEvent = score.events[linearIndex];

  if (loop && (!linearEvent || linearEvent.measure > loop.endMeasure)) {
    return score.events.findIndex((event) => event.measure >= loop.startMeasure);
  }

  return linearIndex;
}
