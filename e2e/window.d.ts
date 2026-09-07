export {};

// Duplicated rather than imported from src/practice/practiceState.ts: this program
// (tsconfig.node.json) doesn't include src, so the two type surfaces stay independent.
declare global {
  interface Window {
    __practiceState?: {
      status: 'waiting' | 'complete';
      nextEventIndex: number;
      satisfiedNoteIds: number[];
      heldNotes: number[];
    };
  }
}
