import type { EngineState } from '../engine/types';

export interface PracticeStateSnapshot {
  nextEventIndex: number;
  heldNotes: number[];
}

/** Only the fields the Layer 3 Playwright suite actually asserts on — see DECISIONS.md. */
export function toPracticeStateSnapshot(state: EngineState): PracticeStateSnapshot {
  return {
    nextEventIndex: state.nextEventIndex,
    heldNotes: [...state.heldNotes],
  };
}

declare global {
  interface Window {
    __practiceState?: PracticeStateSnapshot;
  }
}
