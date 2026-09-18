import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './App';
import { cichaNocScore } from './score/cichaNoc';

/**
 * VirtualKeyboardSource's mapping (src/midi/VirtualKeyboardSource.ts) inverted, over
 * the semitones cicha-noc.musicxml uses, so a test can play the piece as written.
 */
const CODE_FOR_SEMITONE = [
  'KeyZ',
  'KeyS',
  'KeyX',
  'KeyD',
  'KeyC',
  'KeyV',
  'KeyG',
  'KeyB',
  'KeyH',
  'KeyN',
  'KeyJ',
  'KeyM',
  'KeyQ',
  'Digit2',
  'KeyW',
  'Digit3',
  'KeyE',
  'KeyR',
  'Digit5',
  'KeyT',
];

async function renderConnectedApp() {
  const result = render(<App />);
  fireEvent.click(screen.getByTestId('use-virtual-keyboard'));
  await screen.findByText('Connected: computer keyboard');
  return result;
}

function playPerfectly() {
  for (const event of cichaNocScore.events) {
    const codes = event.notes.map((note) => CODE_FOR_SEMITONE[note.pitch - 48]);
    for (const code of codes) fireEvent.keyDown(window, { code });
    for (const code of codes) fireEvent.keyUp(window, { code });
  }
}

describe('App', () => {
  beforeEach(() => localStorage.clear());

  it('renders the on-screen keyboard, not connected to any source initially', () => {
    render(<App />);
    expect(screen.getByText('Not connected')).toBeDefined();
  });

  it('highlights the on-screen key when a computer-keyboard key is pressed', async () => {
    const { container } = await renderConnectedApp();

    fireEvent.keyDown(window, { code: 'KeyZ' });
    expect(container.querySelector('[data-note="48"]')?.getAttribute('data-held')).toBe(
      'true',
    );

    fireEvent.keyUp(window, { code: 'KeyZ' });
    expect(container.querySelector('[data-note="48"]')?.getAttribute('data-held')).toBe(
      'false',
    );
  });

  it('flags a wrong note in the falling-note queue without advancing it', async () => {
    await renderConnectedApp();

    fireEvent.keyDown(window, { code: 'KeyE' }); // E4 (64) — not expected yet

    const current = screen.getAllByTestId('falling-note-event')[0];
    expect(current.dataset.eventId).toBe('m1-b1-e1');
    expect(current.className).toContain('falling-note--wrong');
  });

  it('does not flag a sustained correct chord note as wrong once the engine advances past it', async () => {
    await renderConnectedApp();

    // Completing m1 b1's chord (RH G4 + LH C3+G3) advances straight to m1 b4, which
    // wants G4 again — not C3 or G3, so a naive "is this held pitch still current or
    // next" check on the accumulated held notes would wrongly flag the LH pair the
    // instant this chord completes, even though nothing wrong was played. Assert here
    // and not a beat later: m2 b1 repeats m1 b1's exact chord, so checking past m1 b5
    // would pass under that naive check too, for the wrong reason.
    fireEvent.keyDown(window, { code: 'KeyT' });
    fireEvent.keyDown(window, { code: 'KeyZ' });
    fireEvent.keyDown(window, { code: 'KeyB' });

    const current = screen.getAllByTestId('falling-note-event')[0];
    expect(current.dataset.eventId).toBe('m1-b4-e1');
    expect(current.className).not.toContain('falling-note--wrong');
  });

  it('records an attempt that played the piece to the end', async () => {
    await renderConnectedApp();

    playPerfectly();

    const notesPlayed = cichaNocScore.events.reduce(
      (total, event) => total + event.notes.length,
      0,
    );
    const [row] = screen.getAllByTestId('attempt-history-row');
    // The first cell is the wall-clock time this attempt started; the rest is what it
    // contained. reachedEnd is the last column.
    expect(
      within(row)
        .getAllByRole('cell')
        .slice(1)
        .map((cell) => cell.textContent),
    ).toEqual(['whole piece', String(notesPlayed), '0', '100%', 'yes']);
  });
});
