import type { Loop } from '../engine/types';
import type { HandSelection } from '../score/filterScoreByHand';

/** What one attempt contained, as it is written down — see DECISIONS.md. */
export interface AttemptRecord {
  startedAt: number; // Date.now() at the attempt's first note; also its identity
  endedAt: number;
  notesPlayed: number;
  wrongNoteCount: number;
  reachedEnd: boolean;
  loop?: Loop;
  piece: string; // the piece's id in PIECES, which names it for good
  hands: HandSelection;
}
