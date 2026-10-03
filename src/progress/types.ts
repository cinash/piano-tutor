import type { Loop } from '../engine/types';
import type { HandSelection } from '../score/filterScoreByHand';

/**
 * How a timed attempt was played and how it went. Counters rather than averages, so a
 * derived figure can always be recomputed — see DECISIONS.md.
 */
export interface TimedRecord {
  speed: number; // the speed preset's fraction of DEMO_BPM, 0.75
  bpm: number; // the tempo played to, 49.5
  window: number; // TIMED_WINDOW, in beats
  metronome: boolean;
  missedNoteCount: number;
  offTimeNoteCount: number;
  hitNoteCount: number;
  hitOffsetBeats: number; // signed sum: ÷ hitNoteCount is early (−) or late (+) on average
  hitAbsOffsetBeats: number; // sum of distances: ÷ hitNoteCount is how tight
}

/** What one attempt contained, as it is written down — see DECISIONS.md. */
export interface AttemptRecord {
  startedAt: number; // Date.now() at the attempt's first note; also its identity
  endedAt: number;
  notesPlayed: number;
  wrongNoteCount: number;
  reachedEnd: boolean;
  loop?: Loop;
  piece: string; // the piece's id, bundled or an upload's, which names it for good
  hands: HandSelection;
  timed?: TimedRecord; // absent in wait-mode, and on every record from before step 29
}
