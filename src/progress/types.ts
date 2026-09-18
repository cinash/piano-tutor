import type { Loop } from '../engine/types';

/** What one attempt contained, as it is written down — see DECISIONS.md. */
export interface AttemptRecord {
  startedAt: number; // Date.now() at the attempt's first note; also its identity
  endedAt: number;
  notesPlayed: number;
  wrongNoteCount: number;
  reachedEnd: boolean;
  loop?: Loop;
}
