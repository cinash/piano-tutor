import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import {
  FakeMidiInput,
  FakeMidiOutput,
  fakeMidiAccess,
  stubRequestMidiAccess,
} from './midi/fakeMidiAccess';
import { loadQueueFolded } from './practice/queueFoldStore';
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
 * VirtualKeyboardSource's mapping (src/midi/VirtualKeyboardSource.ts), for the fourteen
 * pitches cicha-noc.musicxml uses, so a test can play the piece as written.
 */
const CODE_FOR_PITCH: Record<number, string> = {
  48: 'KeyZ',
  50: 'KeyX',
  52: 'KeyC',
  53: 'KeyV',
  55: 'KeyB',
  57: 'KeyN',
  60: 'KeyQ',
  64: 'KeyE',
  67: 'KeyT',
  69: 'KeyY',
  71: 'KeyU',
  72: 'KeyI',
  74: 'KeyO',
  77: 'BracketLeft',
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

  it('does not flag a sustained correct note as wrong once the engine advances past it', async () => {
    await renderConnectedApp();

    // G4 completes m1 b1 and A4 completes m1 b2.5, with both keys left down. The engine
    // now waits at m1 b3 for G4, and m2 b1 after it wants E4 — so a naive "is this held
    // pitch still current or next" check on the accumulated held notes would wrongly
    // flag the sustained A4, even though nothing wrong was played.
    fireEvent.keyDown(window, { code: 'KeyT' });
    fireEvent.keyDown(window, { code: 'KeyY' });

    const current = screen.getAllByTestId('falling-note-event')[0];
    expect(current.dataset.eventId).toBe('m1-b3-e1');
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
    // Every note of the piece is a separate re-render of the whole app, which takes
    // about 1.6s alone and can pass 5s when the suite runs this file alongside the
    // others. The default timeout was already marginal before step 21 changed the piece.
  }, 20_000);
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

  afterEach(() => vi.useRealTimers());

  it('plays the piece out of the piano, note-off before note-on where a pitch repeats', async () => {
    const output = new FakeMidiOutput('Digital Piano MIDI 1');
    await startListening(output);

    // m1 b1's G4, at the demo's one fixed velocity.
    expect(output.sent).toEqual([[0x90, 67, 80]]);

    act(() => vi.advanceTimersByTime(12_728)); // m5 b3, 14 beats in at 66 bpm

    // m5 plays D5 twice over: the second note-on has to come after the first's
    // note-off, or the instrument ties the two D5s into one sustained note.
    expect(output.sent.slice(-2)).toEqual([
      [0x80, 74, 0],
      [0x90, 74, 80],
    ]);
  });

  it('silences the instrument on Stop, and sends nothing after it', async () => {
    const output = new FakeMidiOutput('Digital Piano MIDI 1');
    await startListening(output);

    fireEvent.click(screen.getByTestId('listen-to-piece'));

    expect(output.sent.slice(1)).toEqual([[0x80, 67, 0]]);

    act(() => vi.advanceTimersByTime(10_000));

    expect(output.sent).toHaveLength(2);
    expect(screen.getByTestId('listen-to-piece').textContent).toBe('Listen');
  });

  it('leaves practice untouched by a note played while the demo runs', async () => {
    const { container } = await startListening();

    fireEvent.keyDown(window, { code: 'KeyE' }); // E4, which the piece does not want yet

    const current = screen.getAllByTestId('falling-note-event')[0];
    expect(current.dataset.eventId).toBe('m1-b1-e1');
    expect(current.className).not.toContain('falling-note--wrong');
    expect(screen.queryAllByTestId('attempt-history-row')).toHaveLength(0);
    expect(heldPitches(container)).toEqual([67]); // the demo's G4, not E4
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

    expect(chosen.sent).toEqual([[0x90, 67, 80]]);
    expect(other.sent).toEqual([]);
  });

  it('plays the demo at the chosen speed', async () => {
    const output = new FakeMidiOutput('Digital Piano MIDI 1');
    await renderConnectedApp();
    stubRequestMidiAccess(fakeMidiAccess({ outputs: [output] }));
    fireEvent.change(screen.getByTestId('demo-speed-select'), {
      target: { value: '50%' },
    });
    await clickListen();

    // m1 b2.5's A4 falls due at 1364 ms at 100%, and at twice that at 50%.
    act(() => vi.advanceTimersByTime(1_400));
    expect(output.sent).not.toContainEqual([0x90, 69, 80]);

    act(() => vi.advanceTimersByTime(1_400)); // 2800 ms in
    expect(output.sent).toContainEqual([0x90, 69, 80]);
  });

  it('keeps a running demo at the speed it started with when the speed changes', async () => {
    const output = new FakeMidiOutput('Digital Piano MIDI 1');
    await startListening(output);

    fireEvent.change(screen.getByTestId('demo-speed-select'), {
      target: { value: '50%' },
    });
    act(() => vi.advanceTimersByTime(1_400)); // past A4 at 100%, short of it at 50%

    expect(output.sent).toContainEqual([0x90, 69, 80]);
  });

  it('plays silently rather than reporting an error when there is no output port', async () => {
    const { container } = await startListening();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(heldPitches(container)).toEqual([67]);
    // Nothing is asked for during a demonstration; the keys shown are the ones sounding.
    expect(container.querySelectorAll('[data-expected="true"]')).toHaveLength(0);
  });
});

describe('folding the finger queue away', () => {
  /** cicha-noc.musicxml's opening measure: the right hand's G4, A4, G4. */
  function playOpeningMeasure() {
    for (const pitch of [67, 69, 67]) {
      fireEvent.keyDown(window, { code: CODE_FOR_PITCH[pitch] });
      fireEvent.keyUp(window, { code: CODE_FOR_PITCH[pitch] });
    }
  }

  /**
   * Plays the opening measure into a freshly mounted app, folded or not, and reports
   * everything on screen that the engine drives: where practice has reached, and what
   * the attempt it recorded says.
   */
  async function practiseOpeningMeasure(folded: boolean) {
    localStorage.clear(); // or the previous run's attempt is listed in this one too
    const { unmount } = await renderConnectedApp();
    if (folded) fireEvent.click(screen.getByTestId('fold-queue-checkbox'));

    playOpeningMeasure();

    const result = {
      position: screen.getByTestId('position-readout').textContent,
      attempt: within(screen.getByTestId('attempt-history-row'))
        .getAllByRole('cell')
        .slice(1) // the first cell is the wall-clock time the attempt started
        .map((cell) => cell.textContent),
    };
    unmount();
    return result;
  }

  it('takes the queue off the page and puts it back', () => {
    render(<App />);
    expect(screen.getByTestId('falling-notes')).toBeDefined();

    fireEvent.click(screen.getByTestId('fold-queue-checkbox'));
    expect(screen.queryByTestId('falling-notes')).toBeNull();

    fireEvent.click(screen.getByTestId('fold-queue-checkbox'));
    expect(screen.getByTestId('falling-notes')).toBeDefined();
  });

  it('advances the engine exactly as an unfolded queue does', async () => {
    const folded = await practiseOpeningMeasure(true);
    const unfolded = await practiseOpeningMeasure(false);

    expect(folded).toEqual(unfolded);
    // Not two identical nothings: the measure really was played, and recorded.
    expect(unfolded.position).toBe('Measure 2 of 22');
    expect(unfolded.attempt).toEqual(['whole piece', '3', '0', '100%', 'no']);
  });

  it('remembers the choice across a reload', () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByTestId('fold-queue-checkbox'));
    unmount();

    // Through the store as well as the remount: jsdom cannot reload the page, and a
    // flag kept in a module-level variable would survive a remount but not a reload.
    expect(loadQueueFolded()).toBe(true);

    render(<App />);
    expect(screen.queryByTestId('falling-notes')).toBeNull();
  });
});

describe('remembering the piano', () => {
  const PIANO = 'Digital Piano MIDI 1';
  let piano: FakeMidiInput;
  let access: ReturnType<typeof fakeMidiAccess>;

  beforeEach(() => {
    piano = new FakeMidiInput('id-1', PIANO);
    access = fakeMidiAccess({ inputs: [piano] });
    stubRequestMidiAccess(access);
  });

  const rememberPiano = (name: string) =>
    localStorage.setItem('piano-tutor.last-piano.v1', name);
  const rememberedPiano = () => localStorage.getItem('piano-tutor.last-piano.v1');

  /** Plugs the piano in or out the way the browser reports it: a state, then an event. */
  function setPianoState(state: FakeMidiInput['state']) {
    piano.state = state;
    act(() => access.fireStateChange());
  }

  /**
   * Plugs in a second device and waits for the dropdown to list it. The refresh that
   * lists it is one that would have connected the piano, so once it shows, a test can
   * assert that nothing was connected.
   */
  async function refreshDeviceList() {
    access.inputs.set('id-2', new FakeMidiInput('id-2', 'Midi Through Port-0'));
    act(() => access.fireStateChange());
    await screen.findByRole('option', { name: 'Midi Through Port-0' });
  }

  it('connects to the remembered piano on load, with no selection made', async () => {
    rememberPiano(PIANO);
    render(<App />);
    await screen.findByText(`Connected: ${PIANO}`);
  });

  it('remembers the piano chosen from the dropdown', async () => {
    render(<App />);
    await screen.findByRole('option', { name: PIANO });
    fireEvent.change(screen.getByTestId('webmidi-device-select'), {
      target: { value: 'id-1' },
    });
    await screen.findByText(`Connected: ${PIANO}`);

    expect(rememberedPiano()).toBe(PIANO);
  });

  it('keeps the piano remembered when switching to the computer keyboard', async () => {
    rememberPiano(PIANO);
    render(<App />);
    await screen.findByText(`Connected: ${PIANO}`);

    fireEvent.click(screen.getByTestId('use-virtual-keyboard'));
    await screen.findByText('Connected: computer keyboard');

    expect(rememberedPiano()).toBe(PIANO);
  });

  it('forgets the piano on Disconnect, so the next load stays disconnected', async () => {
    rememberPiano(PIANO);
    const { unmount } = render(<App />);
    await screen.findByText(`Connected: ${PIANO}`);

    fireEvent.click(screen.getByTestId('disconnect-button'));
    expect(rememberedPiano()).toBeNull();
    unmount();

    render(<App />);
    await screen.findByRole('option', { name: PIANO });
    expect(screen.getByText('Not connected')).toBeDefined();
  });

  it('forgets the piano on Disconnect from the computer keyboard too', async () => {
    rememberPiano(PIANO);
    render(<App />);
    await screen.findByText(`Connected: ${PIANO}`);
    fireEvent.click(screen.getByTestId('use-virtual-keyboard'));
    await screen.findByText('Connected: computer keyboard');

    fireEvent.click(screen.getByTestId('disconnect-button'));
    expect(rememberedPiano()).toBeNull();

    // The piano is still listed, so a refresh that still remembered it would connect it.
    await refreshDeviceList();
    expect(screen.getByText('Not connected')).toBeDefined();
  });

  it('keeps the piano through an unplug, and reconnects when it is plugged back in', async () => {
    rememberPiano(PIANO);
    render(<App />);
    await screen.findByText(`Connected: ${PIANO}`);

    setPianoState('disconnected');
    await screen.findByText('Not connected');
    expect(rememberedPiano()).toBe(PIANO);

    setPianoState('connected');
    await screen.findByText(`Connected: ${PIANO}`);
  });

  it('leaves the computer keyboard connected when the piano is plugged in', async () => {
    rememberPiano(PIANO);
    piano.state = 'disconnected';
    render(<App />);
    fireEvent.click(screen.getByTestId('use-virtual-keyboard'));
    await screen.findByText('Connected: computer keyboard');

    setPianoState('connected');
    await screen.findByRole('option', { name: PIANO });

    expect(screen.getByText('Connected: computer keyboard')).toBeDefined();
  });

  it('stays disconnected when the remembered piano is not plugged in', async () => {
    rememberPiano('Some Other Piano');
    render(<App />);
    await screen.findByRole('option', { name: PIANO });

    expect(screen.getByText('Not connected')).toBeDefined();
    expect((screen.getByTestId('webmidi-device-select') as HTMLSelectElement).value).toBe(
      '',
    );
  });
});
