import { nextIndexAfter } from '../engine/advance';
import type { Loop } from '../engine/types';
import type { Finger, Hand, Note, Score } from '../score/types';

/** One key of a hand's position: the finger that rests on it. */
export interface FingerKey {
  pitch: number;
  hand: Hand;
  finger: Finger;
}

type FingeredNote = Note & { finger: Finger };

const FINGERS: readonly Finger[] = [1, 2, 3, 4, 5];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const pitchClass = (pitch: number) => ((pitch % 12) + 12) % 12;

/**
 * Each hand's five keys — the right hand's first — fixed by that hand's next fingered
 * note, in the order practice will reach the events: forward from `index`, wrapping at
 * the loop's end as the engine does, for one pass. See DECISIONS.md.
 */
export function handPositions(score: Score, index: number, loop?: Loop): FingerKey[] {
  const upcoming = upcomingNotes(score, index, loop);
  const scale = MAJOR_SCALE.map((degree) => pitchClass(degree + score.fifths * 7));

  return (['right', 'left'] as const).flatMap((hand) => {
    const anchor = upcoming.find((note) => note.hand === hand);
    return anchor ? positionFrom(anchor, scale) : [];
  });
}

function upcomingNotes(score: Score, index: number, loop?: Loop): FingeredNote[] {
  const notes: FingeredNote[] = [];
  const visited = new Set<number>();
  for (
    let i = index;
    i < score.events.length && !visited.has(i);
    i = nextIndexAfter({ nextEventIndex: i, loop }, score)
  ) {
    visited.add(i);
    notes.push(
      ...score.events[i].notes.filter(
        (note): note is FingeredNote => note.finger !== undefined,
      ),
    );
  }
  return notes;
}

/**
 * The five keys a finger on `anchor` fixes, one scale degree per finger: the right hand
 * counts up from its thumb, the left from its little finger. None when the anchor is
 * outside the key, where there is no degree to count from.
 */
function positionFrom(anchor: FingeredNote, scale: number[]): FingerKey[] {
  if (!scale.includes(pitchClass(anchor.pitch))) return [];

  return FINGERS.map((finger) => {
    const degrees =
      anchor.hand === 'right' ? finger - anchor.finger : anchor.finger - finger;
    return {
      pitch: stepScale(anchor.pitch, degrees, scale),
      hand: anchor.hand,
      finger,
    };
  });
}

function stepScale(pitch: number, degrees: number, scale: number[]): number {
  const direction = Math.sign(degrees);
  for (let remaining = Math.abs(degrees); remaining > 0;) {
    pitch += direction;
    if (scale.includes(pitchClass(pitch))) remaining--;
  }
  return pitch;
}
