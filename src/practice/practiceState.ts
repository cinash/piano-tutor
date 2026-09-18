import type { PracticeViewState } from './practiceView';

export interface PracticeStateSnapshot {
  nextEventIndex: number;
  heldNotes: number[];
  notesPlayed: number;
  wrongNoteCount: number;
}

/** Only the fields the Layer 3 Playwright suite actually asserts on — see DECISIONS.md. */
export function toPracticeStateSnapshot(state: PracticeViewState): PracticeStateSnapshot {
  return {
    nextEventIndex: state.engine.nextEventIndex,
    heldNotes: [...state.engine.heldNotes],
    notesPlayed: state.attempt.notesPlayed,
    wrongNoteCount: state.attempt.wrongNoteCount,
  };
}

declare global {
  interface Window {
    __practiceState?: PracticeStateSnapshot;
  }
}
