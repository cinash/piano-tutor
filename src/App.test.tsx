import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import {
  FakeMidiInput,
  FakeMidiOutput,
  fakeMidiAccess,
  stubRequestMidiAccess,
} from './midi/fakeMidiAccess';
import { cichaNocScore } from './score/cichaNoc';

// App decides once, as it is imported, whether the browser has Web MIDI at all, so the
// property has to be there before that — which is what hoisting this above the imports
// does. Its value is never read: beforeEach puts a real fake access in its place.
vi.hoisted(() => {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: null,
    configurable: true,
  });
});

/**
 * VirtualKeyboardSource's mapping (src/midi/VirtualKeyboardSource.ts), for the nine
 * pitches cicha-noc.musicxml uses, so a test can play the piece as written.
 */
const CODE_FOR_PITCH: Record<number, string> = {
  48: 'KeyZ',
  53: 'KeyV',
  55: 'KeyB',
  57: 'KeyN',
  60: 'KeyQ',
  62: 'KeyW',
  64: 'KeyE',
  65: 'KeyR',
  67: 'KeyT',
};

async function renderConnectedApp() {
  const result = render(<App />);
  fireEvent.click(screen.getByTestId('use-virtual-keyboard'));
  await screen.findByText('Connected: computer keyboard');
  return result;
}

function playPerfectly() {
  for (const event of cichaNocScore.events) {
    const codes = event.notes.map((note) => CODE_FOR_PITCH[note.pitch]);
    for (const code of codes) fireEvent.keyDown(window, { code });
    for (const code of codes) fireEvent.keyUp(window, { code });
  }
}

// Saved attempts outlive a render, so every test in the file starts with none.
beforeEach(() => {
  localStorage.clear();
  // Every render lists the MIDI inputs; a test wanting ports stubs its own access over
  // this one.
  stubRequestMidiAccess(fakeMidiAccess());
});

describe('App', () => {
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
    // One row, rewritten note by note, rather than one per note.
    const rows = screen.getAllByTestId('attempt-history-row');
    expect(rows).toHaveLength(1);
    // The first cell is the wall-clock time this attempt started; the rest is what it
    // contained. reachedEnd is the last column.
    expect(
      within(rows[0])
        .getAllByRole('cell')
        .slice(1)
        .map((cell) => cell.textContent),
    ).toEqual(['whole piece', String(notesPlayed), '0', '100%', 'yes']);
  });
});

/** The pitches the on-screen keyboard is showing as sounding, lowest first. */
function heldPitches(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-held="true"]'))
    .map((key) => Number(key.getAttribute('data-note')))
    .sort((a, b) => a - b);
}

describe('listening to the piece', () => {
  /**
   * Connects with real timers — waiting for the status line under fake ones would hang
   * — then hands the clock over before the demo starts. An output port is optional:
   * without one the demo plays silently, which is what a host with no piano does.
   */
  async function startListening(output?: FakeMidiOutput) {
    const rendered = await renderConnectedApp();
    if (output) stubRequestMidiAccess(fakeMidiAccess({ outputs: [output] }));
    await clickListen();
    return rendered;
  }

  /** Hands the clock over, then clicks Listen; awaited, because start() looks the port
   * up before it plays anything. */
  async function clickListen() {
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByTestId('listen-to-piece'));
    });
  }

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'requestMIDIAccess');
  });

  it('plays the piece out of the piano, note-off before note-on where a pitch repeats', async () => {
    const output = new FakeMidiOutput('Digital Piano MIDI 1');
    await startListening(output);

    // m1 b1's chord, at the demo's one fixed velocity.
    expect(output.sent).toEqual([
      [0x90, 67, 80],
      [0x90, 48, 80],
      [0x90, 55, 80],
    ]);

    act(() => vi.advanceTimersByTime(1364)); // m1 b4, 1.5 beats in at 66 bpm

    // m1 b4 is G4 again: its note-on has to come after the chord's note-off, or the
    // instrument ties the two G4s into one sustained note.
    expect(output.sent.slice(3)).toEqual([
      [0x80, 67, 0],
      [0x80, 48, 0],
      [0x80, 55, 0],
      [0x90, 67, 80],
    ]);
  });

  it('silences the instrument on Stop, and sends nothing after it', async () => {
    const output = new FakeMidiOutput('Digital Piano MIDI 1');
    await startListening(output);

    fireEvent.click(screen.getByTestId('listen-to-piece'));

    expect(output.sent.slice(3)).toEqual([
      [0x80, 67, 0],
      [0x80, 48, 0],
      [0x80, 55, 0],
    ]);

    act(() => vi.advanceTimersByTime(10_000));

    expect(output.sent).toHaveLength(6);
    expect(screen.getByTestId('listen-to-piece').textContent).toBe('Listen');
  });

  it('leaves practice untouched by a note played while the demo runs', async () => {
    const { container } = await startListening();

    fireEvent.keyDown(window, { code: 'KeyE' }); // E4, which the piece does not want yet

    const current = screen.getAllByTestId('falling-note-event')[0];
    expect(current.dataset.eventId).toBe('m1-b1-e1');
    expect(current.className).not.toContain('falling-note--wrong');
    expect(screen.queryAllByTestId('attempt-history-row')).toHaveLength(0);
    expect(heldPitches(container)).toEqual([48, 55, 67]); // the demo's chord, not E4
  });

  it('plays through the output named after the piano the player selected', async () => {
    const chosen = new FakeMidiOutput('Digital Piano MIDI 1');
    const other = new FakeMidiOutput('Digital Piano MIDI 2');
    stubRequestMidiAccess(
      fakeMidiAccess({
        inputs: [new FakeMidiInput('id-1', 'Digital Piano MIDI 1')],
        // The chosen one second, so taking whichever port comes first takes the other.
        outputs: [other, chosen],
      }),
    );
    render(<App />);
    // The dropdown fills in asynchronously, from the access the outputs hang off too.
    await screen.findByRole('option', { name: 'Digital Piano MIDI 1' });
    fireEvent.change(screen.getByTestId('webmidi-device-select'), {
      target: { value: 'id-1' },
    });
    await screen.findByText('Connected: Digital Piano MIDI 1');

    await clickListen();

    expect(chosen.sent).toEqual([
      [0x90, 67, 80],
      [0x90, 48, 80],
      [0x90, 55, 80],
    ]);
    expect(other.sent).toEqual([]);
  });

  it('plays silently rather than reporting an error when there is no output port', async () => {
    const { container } = await startListening();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(heldPitches(container)).toEqual([48, 55, 67]);
    // Nothing is asked for during a demonstration; the keys shown are the ones sounding.
    expect(container.querySelectorAll('[data-expected="true"]')).toHaveLength(0);
  });
});
