import type { EngineState } from '../engine/types';

export interface PracticeStateSnapshot {
  status: EngineState['status'];
  nextEventIndex: number;
  satisfiedNoteIds: number[];
  heldNotes: number[];
}

/**
 * `loop` (unwired until step 5) and `pendingEarlyNotes` (internal bookkeeping
 * `advance()` consumes and clears itself) are left out — add a field here when a test
 * actually needs to assert on it, rather than mirroring `EngineState` wholesale.
 */
export function toPracticeStateSnapshot(state: EngineState): PracticeStateSnapshot {
  return {
    status: state.status,
    nextEventIndex: state.nextEventIndex,
    satisfiedNoteIds: [...state.satisfiedNoteIds],
    heldNotes: [...state.heldNotes],
  };
}

declare global {
  interface Window {
    __practiceState?: PracticeStateSnapshot;
  }
}
