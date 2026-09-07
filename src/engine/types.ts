export interface EngineState {
  status: 'waiting' | 'complete';
  nextEventIndex: number; // index into Score.events
  satisfiedNoteIds: Set<number>; // which pitches of the current chord have sounded
  heldNotes: Set<number>; // currently-down pitches, for keyboard rendering
  loop?: { startMeasure: number; endMeasure: number }; // wired up properly in step 5
  // Pitches of the *next* event played early, each with the clock time they
  // sounded — consumed by early-note grace when the current event completes.
  pendingEarlyNotes: Map<number, number>;
}

/**
 * The timing tolerances wait-mode practice tunes, in one place, for whoever adjusts
 * them after watching real practice sessions. Only `earlyNoteGraceMs` is consulted
 * by `advance()`; see DECISIONS.md for why the other two aren't.
 */
export const ENGINE_TIMING = {
  chordRollWindowMs: 150,
  earlyNoteGraceMs: 50,
  noteOffDebounceMs: 30,
} as const;
