import type { Score, TimeSignature } from './types';

/**
 * The time signature in force in a measure. parseScore records one only where it differs
 * from its own 4/4 default, so a score with none, or a measure before the first, is 4/4.
 */
export function timeSignatureAt(
  score: Score,
  measure: number,
): Pick<TimeSignature, 'beats' | 'beatType'> {
  return (
    score.timeSignatures.filter((signature) => signature.measure <= measure).at(-1) ?? {
      beats: 4,
      beatType: 4,
    }
  );
}

/** Where a measure starts, in quarter-note beats from the start of the piece. */
export function measureStartTime(score: Score, measure: number): number {
  let startTime = 0;
  for (let before = 1; before < measure; before++) {
    const { beats, beatType } = timeSignatureAt(score, before);
    startTime += (beats * 4) / beatType;
  }
  return startTime;
}
