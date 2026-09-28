import { beforeEach, describe, expect, it } from 'vitest';

import { loadAttempts, saveAttempts } from './attemptStore';
import type { AttemptRecord } from './types';

const STORAGE_KEY = 'piano-tutor.attempts.v1';

const looped: AttemptRecord = {
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_060_000,
  notesPlayed: 12,
  wrongNoteCount: 2,
  reachedEnd: false,
  loop: { startMeasure: 1, endMeasure: 2 },
  piece: 'beyer-op101-12',
  hands: 'left',
};

const wholePiece: AttemptRecord = {
  startedAt: 1_699_000_000_000,
  endedAt: 1_699_000_120_000,
  notesPlayed: 41,
  wrongNoteCount: 0,
  reachedEnd: true,
  piece: 'cicha-noc',
  hands: 'both',
};

const timed: AttemptRecord = {
  ...wholePiece,
  timed: {
    speed: 0.75,
    bpm: 49.5,
    window: 0.25,
    metronome: false,
    missedNoteCount: 3,
    offTimeNoteCount: 1,
    hitNoteCount: 30,
    hitOffsetBeats: -1.5,
    hitAbsOffsetBeats: 4.25,
  },
};

describe('attemptStore', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips records, with and without a loop range', () => {
    saveAttempts([looped, wholePiece]);

    expect(loadAttempts()).toEqual([looped, wholePiece]);
  });

  it('round-trips a timed record beside a wait-mode one, which has no timed field', () => {
    saveAttempts([timed, wholePiece]);

    expect(loadAttempts()).toEqual([timed, wholePiece]);
  });

  it('reads a record with a malformed timed field as no history', () => {
    const everyFieldMistyped = Object.keys(timed.timed!).map((key) => ({
      ...timed.timed,
      [key]: 'mistyped',
    }));
    const missingOne = { ...timed.timed, missedNoteCount: undefined };

    for (const malformed of [null, 'yes', missingOne, ...everyFieldMistyped]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...timed, timed: malformed }]));
      expect(loadAttempts()).toEqual([]);
    }
  });

  it('reads an absent key as no history', () => {
    expect(loadAttempts()).toEqual([]);
  });

  it('reads malformed JSON as no history', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    expect(loadAttempts()).toEqual([]);
  });

  it('reads a well-formed value that is not an array as no history', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ startedAt: 1 }));

    expect(loadAttempts()).toEqual([]);
  });

  it('reads records with a missing or mistyped field as no history', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...looped, reachedEnd: 'yes' }]));
    expect(loadAttempts()).toEqual([]);

    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ startedAt: 1, endedAt: 2 }]));
    expect(loadAttempts()).toEqual([]);
  });

  it('reads records from before the piece and hands were recorded as no history', () => {
    // An undefined field is left out by JSON.stringify: stored without it.
    for (const record of [
      { ...looped, piece: undefined },
      { ...looped, hands: undefined },
      { ...looped, piece: 12 },
      { ...looped, hands: 'up' },
    ]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([record]));
      expect(loadAttempts()).toEqual([]);
    }
  });

  it('reads records with a malformed loop as no history', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ ...looped, loop: { startMeasure: 1 } }]),
    );

    expect(loadAttempts()).toEqual([]);
  });
});
