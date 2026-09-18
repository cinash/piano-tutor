import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AttemptHistory } from './AttemptHistory';
import type { AttemptRecord } from './types';

const newer: AttemptRecord = {
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_060_000,
  notesPlayed: 12,
  wrongNoteCount: 2,
  reachedEnd: false,
  loop: { startMeasure: 1, endMeasure: 2 },
};

const older: AttemptRecord = {
  startedAt: 1_699_000_000_000,
  endedAt: 1_699_000_120_000,
  notesPlayed: 41,
  wrongNoteCount: 0,
  reachedEnd: true,
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
    render(<AttemptHistory records={[]} />);

    expect(screen.getByTestId('attempt-history-empty')).toBeDefined();
    expect(screen.queryByTestId('attempt-history')).toBeNull();
  });

  it('lists the records in the order given, with accuracy derived from the counters', () => {
    render(<AttemptHistory records={[newer, older]} />);

    expect(screen.getAllByTestId('attempt-history-row').map(cellsAfterTheTime)).toEqual([
      ['measures 1–2', '12', '2', '83%', 'no'],
      ['whole piece', '41', '0', '100%', 'yes'],
    ]);
  });

  it('shows a dash rather than NaN% for an attempt with no notes', () => {
    render(<AttemptHistory records={[{ ...older, notesPlayed: 0 }]} />);

    const [row] = screen.getAllByTestId('attempt-history-row');
    expect(cellsAfterTheTime(row)).toEqual(['whole piece', '0', '0', '—', 'yes']);
  });
});
