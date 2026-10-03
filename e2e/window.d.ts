export {};

// Duplicated rather than imported from src/practice/practiceState.ts: this program
// (tsconfig.node.json) doesn't include src — see DECISIONS.md.
declare global {
  interface Window {
    __practiceState?: {
      nextEventIndex: number;
      heldNotes: number[];
      notesPlayed: number;
      wrongNoteCount: number;
      missedNoteCount: number;
    };
    /** Set by recordCspViolations in page.ts. */
    cspViolations: string[];
  }
}
