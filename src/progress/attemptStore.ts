import type { Loop } from '../engine/types';
import { HAND_SELECTIONS } from '../score/filterScoreByHand';
import type { AttemptRecord, TimedRecord } from './types';

const STORAGE_KEY = 'piano-tutor.attempts.v1';

function isLoop(value: unknown): value is Loop {
  return (
    typeof value === 'object' &&
    value !== null &&
    'startMeasure' in value &&
    typeof value.startMeasure === 'number' &&
    'endMeasure' in value &&
    typeof value.endMeasure === 'number'
  );
}

function isTimedRecord(value: unknown): value is TimedRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const numbers = [
    'speed',
    'bpm',
    'window',
    'missedNoteCount',
    'offTimeNoteCount',
    'hitNoteCount',
    'hitOffsetBeats',
    'hitAbsOffsetBeats',
  ];
  return (
    numbers.every((key) => typeof record[key] === 'number') &&
    typeof record.metronome === 'boolean'
  );
}

export function isAttemptRecordArray(value: unknown): value is AttemptRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.startedAt === 'number' &&
        typeof item.endedAt === 'number' &&
        typeof item.notesPlayed === 'number' &&
        typeof item.wrongNoteCount === 'number' &&
        typeof item.reachedEnd === 'boolean' &&
        (item.loop === undefined || isLoop(item.loop)) &&
        typeof item.piece === 'string' &&
        HAND_SELECTIONS.includes(item.hands) &&
        (item.timed === undefined || isTimedRecord(item.timed)),
    )
  );
}

/** Anything that isn't a stored AttemptRecord[] reads as no history — see DECISIONS.md. */
export function loadAttempts(): AttemptRecord[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return isAttemptRecordArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAttempts(records: AttemptRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
