import type { AttemptRecord } from './types';

/**
 * Adds the imported records the history doesn't already hold, matched on `startedAt`,
 * and returns the result newest first — the order `AttemptHistory` promises. Existing
 * records are left alone, so carrying a file between two machines is never destructive.
 */
export function mergeAttempts(
  existing: AttemptRecord[],
  imported: AttemptRecord[],
): AttemptRecord[] {
  const known = new Set(existing.map((record) => record.startedAt));
  const added = imported.filter((record) => !known.has(record.startedAt));
  return [...existing, ...added].sort((a, b) => b.startedAt - a.startedAt);
}
