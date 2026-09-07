import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ScoreEvent } from '../score/types';
import { FallingNotes } from './FallingNotes';

const EVENTS: ScoreEvent[] = [
  {
    id: 'e0',
    notes: [
      { pitch: 60, hand: 'right', finger: 1 },
      { pitch: 55, hand: 'left', finger: 5 },
    ],
    measure: 1,
    beat: 1,
    startTime: 0,
    durationBeats: 1,
  },
  {
    id: 'e1',
    notes: [{ pitch: 62, hand: 'right' }], // no fingering authored
    measure: 1,
    beat: 2,
    startTime: 1,
    durationBeats: 1,
  },
  {
    id: 'e2',
    notes: [{ pitch: 64, hand: 'right', finger: 3 }],
    measure: 1,
    beat: 3,
    startTime: 2,
    durationBeats: 1,
  },
];

describe('FallingNotes', () => {
  it('renders the upcoming events starting at the current one, blank when no fingering was authored', () => {
    render(
      <FallingNotes
        events={EVENTS}
        status="waiting"
        nextEventIndex={1}
        satisfiedNoteIds={new Set()}
        hasWrongNote={false}
      />,
    );

    const events = screen.getAllByTestId('falling-note-event');
    expect(events.map((el) => el.dataset.eventId)).toEqual(['e1', 'e2']);
    expect(events[0].textContent).toBe('');
  });

  it('marks the current block distinctly from the rest of the queue', () => {
    render(
      <FallingNotes
        events={EVENTS}
        status="waiting"
        nextEventIndex={0}
        satisfiedNoteIds={new Set()}
        hasWrongNote={false}
      />,
    );

    const events = screen.getAllByTestId('falling-note-event');
    expect(events[0].className).toContain('falling-note--current');
    expect(events[1].className).not.toContain('falling-note--current');
  });

  it('dims a chord note once it has sounded, while the chord is still waiting on the rest', () => {
    render(
      <FallingNotes
        events={EVENTS}
        status="waiting"
        nextEventIndex={0}
        satisfiedNoteIds={new Set([60])}
        hasWrongNote={false}
      />,
    );

    const chips = screen
      .getAllByTestId('falling-note-event')[0]
      .querySelectorAll('.falling-note__finger');
    expect(chips[0].className).toContain('falling-note__finger--satisfied');
    expect(chips[1].className).not.toContain('falling-note__finger--satisfied');
  });

  it('flags the current block as wrong while a wrong note is held, and not otherwise', () => {
    const { rerender } = render(
      <FallingNotes
        events={EVENTS}
        status="waiting"
        nextEventIndex={0}
        satisfiedNoteIds={new Set()}
        hasWrongNote={true}
      />,
    );
    expect(screen.getAllByTestId('falling-note-event')[0].className).toContain(
      'falling-note--wrong',
    );

    rerender(
      <FallingNotes
        events={EVENTS}
        status="waiting"
        nextEventIndex={0}
        satisfiedNoteIds={new Set()}
        hasWrongNote={false}
      />,
    );
    expect(screen.getAllByTestId('falling-note-event')[0].className).not.toContain(
      'falling-note--wrong',
    );
  });

  it('shows a completion message once the engine has finished the piece', () => {
    render(
      <FallingNotes
        events={EVENTS}
        status="complete"
        nextEventIndex={3}
        satisfiedNoteIds={new Set()}
        hasWrongNote={false}
      />,
    );

    expect(screen.getByTestId('falling-notes').textContent).toBe('Piece complete');
  });
});
