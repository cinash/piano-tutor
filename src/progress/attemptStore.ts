import type { Loop } from '../engine/types';
import type { AttemptRecord } from './types';

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
        ['both', 'left', 'right'].includes(item.hands),
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
