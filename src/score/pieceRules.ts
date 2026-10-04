import { measureStartTime, timeSignatureAt } from './measureStartTime';
import type { Finger, Score } from './types';

// C3 to G5: VirtualKeyboardSource's map, which is not exported for a test's sake.
export const COMPUTER_KEYBOARD_LOW = 48;
export const COMPUTER_KEYBOARD_HIGH = 79;

/**
 * Whether a finger is one the keyboard shows: 1 to 5. The type says so already, but
 * readFinger casts the text without checking it, so `0`, `6` and `NaN` reach here.
 */
export function isFingered(finger: Finger | undefined): boolean {
  return finger !== undefined && Number.isInteger(finger) && finger >= 1 && finger <= 5;
}

export function hasPitchOutside(score: Score, low: number, high: number): boolean {
  return score.events.some((event) =>
    event.notes.some((note) => note.pitch < low || note.pitch > high),
  );
}

/**
 * What timed play assumes of a piece: one signature over quarter-note beats, so the click
 * and its accents are periodic; no pickup or short bar, so a bar starts where
 * measureStartTime says; and events at least half a beat apart, so the ±¼-beat windows
 * never overlap. A piece that fails this is wait-mode only for an upload, and needs timed
 * play extended, or leaving out, for a bundled piece.
 */
export function timedPlayable(score: Score): boolean {
  // parseScore records a time signature only when it changes, so one after bar 1 is a change.
  if (score.timeSignatures.some((signature) => signature.measure > 1)) return false;
  if (timeSignatureAt(score, 1).beatType !== 4) return false;

  for (const { measure, startTime } of score.events) {
    if (startTime < measureStartTime(score, measure)) return false;
    if (startTime >= measureStartTime(score, measure + 1)) return false;
  }
  for (let i = 1; i < score.events.length; i++) {
    if (score.events[i].startTime - score.events[i - 1].startTime < 0.5) return false;
  }
  return true;
}
