import { measureStartTime, timeSignatureAt } from './measureStartTime';
import type { Finger, Score } from './types';

// C3 to G5: VirtualKeyboardSource's map, which is not exported for a test's sake.
export const COMPUTER_KEYBOARD_LOW = 48;
export const COMPUTER_KEYBOARD_HIGH = 79;

// The on-screen keyboard's default preset, C2 to B5 (src/config.ts).
export const DEFAULT_PRESET_LOW = 36;
export const DEFAULT_PRESET_HIGH = 83;

/** A finger the keyboard can show: a whole number from 1 to 5, the range FINGER_COLORS covers. */
export function isFingered(finger: Finger | undefined): boolean {
  return finger !== undefined && Number.isInteger(finger) && finger >= 1 && finger <= 5;
}

/**
 * What timed play assumes of a piece: one signature over quarter-note beats, so the click
 * and its accents are periodic; no pickup or short bar, so a bar starts where
 * measureStartTime says; and events at least half a beat apart, so the ±¼-beat windows
 * never overlap. A piece that fails this is wait-mode only for uploads, and needs timed
 * play extended, or leaving out, for a bundled piece.
 */
export function timedPlayable(score: Score): boolean {
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
