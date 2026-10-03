import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PIECES } from '../score/pieces';
import { AttemptHistory } from './AttemptHistory';
import type { AttemptRecord } from './types';

const newer: AttemptRecord = {
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_060_000,
  notesPlayed: 12,
  wrongNoteCount: 2,
  reachedEnd: false,
  loop: { startMeasure: 1, endMeasure: 2 },
  piece: 'beyer-op101-12',
  hands: 'both',
};

const older: AttemptRecord = {
  startedAt: 1_699_000_000_000,
  endedAt: 1_699_000_120_000,
  notesPlayed: 41,
  wrongNoteCount: 0,
  reachedEnd: true,
  piece: 'beyer-op101-38', // not offered, so shown by its id
  hands: 'right',
};

/** Every cell but the first — the "when" cell is a locale- and zone-dependent render. */
function cellsAfterTheTime(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .slice(1)
    .map((cell) => cell.textContent);
}

describe('AttemptHistory', () => {
  it('shows an empty state before the first attempt', () => {
    render(<AttemptHistory records={[]} pieces={PIECES} />);

    expect(screen.getByTestId('attempt-history-empty')).toBeDefined();
    expect(screen.queryByTestId('attempt-history')).toBeNull();
  });

  it('lists the records in the order given, with accuracy derived from the counters', () => {
    render(<AttemptHistory records={[newer, older]} pieces={PIECES} />);

    expect(screen.getAllByTestId('attempt-history-row').map(cellsAfterTheTime)).toEqual([
      ['Beyer Op. 101 No. 12', 'Wait', 'measures 1–2', '12', '2', '—', '83%', 'no'],
      ['beyer-op101-38', 'Wait', 'whole piece', '41', '0', '—', '100%', 'yes'],
    ]);
  });

  it('shows a dash rather than NaN% for an attempt with no notes', () => {
    render(<AttemptHistory records={[{ ...older, notesPlayed: 0 }]} pieces={PIECES} />);

    const [row] = screen.getAllByTestId('attempt-history-row');
    expect(cellsAfterTheTime(row)).toEqual([
      'beyer-op101-38',
      'Wait',
      'whole piece',
      '0',
      '0',
      '—',
      '—',
      'yes',
    ]);
  });

  it('shows a timed attempt’s speed as its mode, and its missed notes', () => {
    const timed: AttemptRecord = {
      ...newer,
      timed: {
        speed: 0.75,
        bpm: 49.5,
        window: 0.25,
        metronome: true,
        missedNoteCount: 3,
        offTimeNoteCount: 1,
        hitNoteCount: 8,
        hitOffsetBeats: 0.4,
        hitAbsOffsetBeats: 1.2,
      },
    };
    render(<AttemptHistory records={[timed]} pieces={PIECES} />);

    const [row] = screen.getAllByTestId('attempt-history-row');
    expect(cellsAfterTheTime(row)).toEqual([
      'Beyer Op. 101 No. 12',
      'Timed 75%',
      'measures 1–2',
      '12',
      '2',
      '3',
      '83%',
      'no',
    ]);
  });
});
