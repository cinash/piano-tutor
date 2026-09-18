import { describe, expect, it } from 'vitest';

import { mergeAttempts } from './mergeAttempts';
import type { AttemptRecord } from './types';

function record(startedAt: number, notesPlayed: number): AttemptRecord {
  return {
    startedAt,
    endedAt: startedAt + 60_000,
    notesPlayed,
    wrongNoteCount: 0,
    reachedEnd: false,
  };
}

const older = record(1_700_000_000_000, 10);
const newer = record(1_700_000_600_000, 20);

describe('mergeAttempts', () => {
  it('adds the imported records and returns everything newest first', () => {
    const middle = record(1_700_000_300_000, 15);

    expect(mergeAttempts([newer, older], [middle])).toEqual([newer, middle, older]);
  });

  it('leaves an existing record alone when the import repeats its startedAt', () => {
    const rewritten = { ...older, notesPlayed: 99 };

    expect(mergeAttempts([older], [rewritten, newer])).toEqual([newer, older]);
  });

  it('takes the whole import into an empty history', () => {
    expect(mergeAttempts([], [older, newer])).toEqual([newer, older]);
  });
});
