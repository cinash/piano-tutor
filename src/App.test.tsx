import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import {
  FakeMidiInput,
  FakeMidiOutput,
  fakeMidiAccess,
  stubRequestMidiAccess,
} from './midi/fakeMidiAccess';
import { ACCENT_HZ, CLICK_HZ } from './practice/metronome';
import { msPerBeatAt } from './practice/timedPlay';
import { loadQueueFolded } from './practice/queueFoldStore';
import { loadAttempts } from './progress/attemptStore';
import { cichaNocScore } from './score/cichaNoc';
import { PIECES } from './score/pieces';

// App decides once, as it is imported, whether the browser has Web MIDI at all, so the
// property has to be there before that — which is what hoisting this above the imports
// does. Its value is never read: beforeEach puts a real fake access in its place.
vi.hoisted(() => {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: null,
    configurable: true,
  });
});

const beyerNo12 = PIECES.find((piece) => piece.id === 'beyer-op101-12')!.score;

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

function playNote(pitch: number) {
  fireEvent.keyDown(window, { code: CODE_FOR_PITCH[pitch] });
  fireEvent.keyUp(window, { code: CODE_FOR_PITCH[pitch] });
}

function chooseSpeed(label: string) {
  fireEvent.change(screen.getByTestId('demo-speed-select'), {
    target: { value: label },
  });
}

function choosePiece(id: string) {
  fireEvent.change(screen.getByTestId('piece-select'), { target: { value: id } });
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
    ).toEqual([
      'Cicha Noc',
      'Wait',
      'whole piece',
      String(notesPlayed),
      '0',
      '—',
      '100%',
      'yes',
    ]);
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

/** The history's newest row, from its piece to whether it reached the end. */
function newestRow() {
  return within(screen.getAllByTestId('attempt-history-row')[0])
    .getAllByRole('cell')
    .slice(1) // the first cell is the wall-clock time the attempt started
    .map((cell) => cell.textContent);
}

/** The keys marked as the ones to press next, lowest first. */
function expectedPitches(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-expected="true"]'))
    .map((key) => Number(key.getAttribute('data-note')))
    .sort((a, b) => a - b);
}

/** The keys a hand's position is shaded on, lowest first. */
function positionPitches(container: HTMLElement, hand: 'left' | 'right') {
  return Array.from(container.querySelectorAll(`[data-position-hand="${hand}"]`))
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

  it('moves the hand positions with the demo, and back to practice on Stop', async () => {
    const { container } = await startListening();

    act(() => vi.advanceTimersByTime(12_728)); // m5 b3, 14 beats in at 66 bpm

    // Practice is still at m1, where the right hand sits on E4-B4; the demo is at m5.
    expect(positionPitches(container, 'right')).toEqual([71, 72, 74, 76, 77]); // B4-F5
    expect(container.querySelectorAll('[data-expected="true"]')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('listen-to-piece'));

    expect(positionPitches(container, 'right')).toEqual([64, 65, 67, 69, 71]); // E4-B4
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

  it('stops when another piece is chosen, and sends nothing after it', async () => {
    const output = new FakeMidiOutput('Digital Piano MIDI 1');
    await startListening(output);

    choosePiece('beyer-op101-12');
    const sent = output.sent.length;
    act(() => vi.advanceTimersByTime(10_000));

    expect(output.sent).toHaveLength(sent);
    expect(screen.getByTestId('listen-to-piece').textContent).toBe('Listen');
  });

  it('plays silently rather than reporting an error when there is no output port', async () => {
    const { container } = await startListening();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(heldPitches(container)).toEqual([67]);
    // Nothing is asked for during a demonstration; the keys shown are the ones sounding.
    expect(container.querySelectorAll('[data-expected="true"]')).toHaveLength(0);
  });
});

describe('where the hands sit', () => {
  it('shows only the hand being practised', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByTestId('hands-left'));

    expect(positionPitches(container, 'left')).toEqual([52, 53, 55, 57, 59]); // E3-B3
    expect(positionPitches(container, 'right')).toEqual([]);
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
    expect(unfolded.attempt).toEqual([
      'Cicha Noc',
      'Wait',
      'whole piece',
      '3',
      '0',
      '—',
      '100%',
      'no',
    ]);
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

describe('choosing the piece', () => {
  const pieceSelect = () => screen.getByTestId('piece-select') as HTMLSelectElement;

  it('can be chosen before anything is connected, and starts at its first note', () => {
    const { container } = render(<App />);
    expect(expectedPitches(container)).toEqual([67]); // Cicha Noc's G4

    choosePiece('beyer-op101-12');

    expect(screen.getByTestId('position-readout').textContent).toBe('Measure 1 of 8');
    expect(expectedPitches(container)).toEqual([60, 72]); // No. 12's C4 and C5
  });

  it('is practised from its first note, whatever was played of the last one', async () => {
    const { container } = await renderConnectedApp();
    fireEvent.keyDown(window, { code: 'KeyT' }); // Cicha Noc's G4
    fireEvent.keyUp(window, { code: 'KeyT' });

    choosePiece('beyer-op101-12');
    // Its first chord, not the event after it: Cicha Noc had moved on one event, and
    // index 1 of No. 12 is D5.
    expect(expectedPitches(container)).toEqual([60, 72]);

    for (const code of ['KeyQ', 'KeyI']) fireEvent.keyDown(window, { code });

    // The engine reads the new piece: its C4 and C5 move it on to m1 b2's D5.
    expect(expectedPitches(container)).toEqual([74]);
  });

  it('clears a loop, whose bars the new piece may not have', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('loop-enabled-checkbox'));
    fireEvent.change(screen.getByTestId('loop-start-input'), { target: { value: '18' } });

    choosePiece('beyer-op101-12');

    expect(
      (screen.getByTestId('loop-enabled-checkbox') as HTMLInputElement).checked,
    ).toBe(false);
    expect((screen.getByTestId('loop-end-input') as HTMLInputElement).value).toBe('8');
  });

  it('remembers the choice across a reload', () => {
    const { unmount } = render(<App />);
    choosePiece('beyer-op101-12');
    unmount();

    render(<App />);

    expect(pieceSelect().value).toBe('beyer-op101-12');
  });

  it('opens on the first piece when the one remembered is no longer offered', () => {
    localStorage.setItem('piano-tutor.piece.v1', 'beyer-op101-38');
    render(<App />);

    expect(pieceSelect().value).toBe('cicha-noc');
  });

  it('records the piece, and the hands it was practised with, in the attempt', async () => {
    await renderConnectedApp();
    choosePiece('beyer-op101-12');
    fireEvent.click(screen.getByTestId('hands-left'));

    fireEvent.keyDown(window, { code: 'KeyQ' }); // No. 12's left-hand C4

    expect(loadAttempts()).toMatchObject([{ piece: 'beyer-op101-12', hands: 'left' }]);
  });

  it('does not jump to a piece on a typed letter, which the computer keyboard plays', () => {
    render(<App />);

    // fireEvent returns false when a handler prevented the default.
    expect(fireEvent.keyDown(pieceSelect(), { key: 'b' })).toBe(false);
    expect(fireEvent.keyDown(pieceSelect(), { key: 'ArrowDown' })).toBe(true);
    // A shortcut such as find is left to the browser.
    expect(fireEvent.keyDown(pieceSelect(), { key: 'f', ctrlKey: true })).toBe(true);
  });
});

/** A click the stubbed AudioContext sounded, heard at `at` in performance.now() time. */
interface Click {
  at: number;
  hz: number;
}

let clicks: Click[] = [];
let outputLatency = 0;

/**
 * jsdom has no Web Audio, so this stands in for it as fakeMidiAccess does for Web MIDI:
 * each oscillator started is a click, heard `outputLatency` seconds after it is sent, and
 * one stopped with no time before it sounded is a click taken back. Its clock is
 * performance.now(), which the fake timers drive.
 */
class FakeAudioContext {
  readonly destination = {};

  get outputLatency() {
    return outputLatency;
  }

  get currentTime() {
    return performance.now() / 1000;
  }

  resume() {
    return Promise.resolve();
  }

  createGain() {
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: (node: unknown) => node,
    };
  }

  createOscillator() {
    let click: Click | undefined;
    const oscillator = {
      frequency: { value: 0 },
      onended: null,
      connect: (node: unknown) => node,
      start: (when: number) => {
        click = { at: (when + outputLatency) * 1000, hz: oscillator.frequency.value };
        clicks.push(click);
      },
      stop: (when?: number) => {
        if (when === undefined && click && click.at > performance.now()) {
          clicks = clicks.filter((other) => other !== click);
        }
      },
    };
    return oscillator;
  }
}

describe('timed play', () => {
  /** Connects under real timers, as startListening does, then hands the clock over. */
  async function renderWithFakeTimers() {
    const rendered = await renderConnectedApp();
    vi.useFakeTimers();
    return rendered;
  }

  /** React sets the timer for the next miss only when an act() ends, so time passes in steps. */
  function advanceInSteps(ms: number) {
    for (let left = ms; left > 0; left -= 100) {
      act(() => vi.advanceTimersByTime(Math.min(100, left)));
    }
  }

  /** Timed with the metronome cleared, so no snap moves the clock off the first note. */
  function chooseTimedWithoutMetronome() {
    fireEvent.click(screen.getByTestId('mode-timed'));
    fireEvent.click(screen.getByTestId('metronome-checkbox'));
  }

  // Choosing Timed starts the metronome, so every test here has its stand-in.
  beforeEach(() => {
    clicks = [];
    outputLatency = 0;
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Cicha Noc's G4 starts the clock; A4 falls due 1364 ms later at 100%, and its window
  // closes 227 ms after that, at 1591 ms. G4 at m1 b3 comes next.
  it('moves on past a note not played in time', async () => {
    const { container } = await renderWithFakeTimers();
    chooseTimedWithoutMetronome();

    playNote(67);
    advanceInSteps(1_500);
    expect(expectedPitches(container)).toEqual([69]);

    advanceInSteps(100);
    expect(expectedPitches(container)).toEqual([67]);
  });

  it('waits on the note however long it takes in Wait mode', async () => {
    const { container } = await renderWithFakeTimers();

    playNote(67);
    advanceInSteps(5_000);

    expect(expectedPitches(container)).toEqual([69]);
  });

  it('gives a slower speed longer: at 50%, until 3182 ms', async () => {
    const { container } = await renderWithFakeTimers();
    chooseSpeed('50%');
    chooseTimedWithoutMetronome();

    playNote(67);
    advanceInSteps(1_600);
    expect(expectedPitches(container)).toEqual([69]);

    advanceInSteps(1_600);
    expect(expectedPitches(container)).toEqual([67]);
  });

  it('stops the clock for Listen, leaving practice where it was', async () => {
    const { container } = await renderWithFakeTimers();
    chooseTimedWithoutMetronome();
    playNote(67);

    await act(async () => {
      fireEvent.click(screen.getByTestId('listen-to-piece'));
    });
    advanceInSteps(10_000);
    fireEvent.click(screen.getByTestId('listen-to-piece'));
    // Stopped, not paused: A4 is still waited on after its time would have passed.
    advanceInSteps(2_000);

    expect(expectedPitches(container)).toEqual([69]);
  });

  it('restarts a timed attempt when the speed, the metronome or the mode changes', async () => {
    const { container } = await renderWithFakeTimers();
    chooseTimedWithoutMetronome();

    playNote(67);
    chooseSpeed('75%');
    expect(expectedPitches(container)).toEqual([67]);

    playNote(67);
    fireEvent.click(screen.getByTestId('metronome-checkbox'));
    expect(expectedPitches(container)).toEqual([67]);

    playNote(67);
    fireEvent.click(screen.getByTestId('mode-wait'));
    expect(expectedPitches(container)).toEqual([67]);

    // Each restart closed the attempt before it.
    expect(loadAttempts()).toHaveLength(3);
  });

  it('leaves a wait-mode attempt as it was when the speed changes', async () => {
    const { container } = await renderWithFakeTimers();
    playNote(67);
    const [{ endedAt }] = loadAttempts();

    advanceInSteps(1_000);
    chooseSpeed('75%');

    expect(expectedPitches(container)).toEqual([69]);
    expect(loadAttempts()).toMatchObject([{ endedAt }]);
  });

  it('records a timed run with its speed, its misses and the child’s timing', async () => {
    await renderWithFakeTimers();
    chooseTimedWithoutMetronome();

    playNote(67);
    advanceInSteps(1_600); // A4 missed
    playNote(67); // m1 b3's G4, due at 1818: early, inside its window

    expect(newestRow()).toEqual([
      'Cicha Noc',
      'Timed 100%',
      'whole piece',
      '2',
      '0',
      '1',
      '100%',
      'no',
    ]);
    const [{ timed }] = loadAttempts();
    expect(timed).toMatchObject({
      speed: 1,
      bpm: 66,
      window: 0.25,
      metronome: false,
      missedNoteCount: 1,
      offTimeNoteCount: 0,
      hitNoteCount: 1,
    });
    expect(timed?.hitOffsetBeats).toBeCloseTo(-0.24);
    expect(timed?.hitAbsOffsetBeats).toBeCloseTo(0.24);
  });

  it('records a run the clock carried to the end as not reaching it', async () => {
    await renderWithFakeTimers();
    choosePiece('beyer-op101-12');
    chooseSpeed('150%');
    chooseTimedWithoutMetronome();

    fireEvent.keyDown(window, { code: CODE_FOR_PITCH[60] }); // No. 12's C4 and C5
    fireEvent.keyDown(window, { code: CODE_FOR_PITCH[72] });
    advanceInSteps(20_000); // eight bars of 4/4 at 99 beats a minute

    // Every note of the piece but the two played is missed.
    const notes = beyerNo12.events.flatMap((event) => event.notes).length;
    expect(screen.getByTestId('position-readout').textContent).toBe('Complete');
    expect(newestRow()).toEqual([
      'Beyer Op. 101 No. 12',
      'Timed 150%',
      'whole piece',
      '2',
      '0',
      String(notes - 2),
      '100%',
      'no',
    ]);
  });

  describe('the metronome', () => {
    /** The clicks sounded from `since`, in ms after it, rounded, and whether accented. */
    function clicksFrom(since: number) {
      return clicks
        .filter((click) => click.at >= since)
        .map((click) => [Math.round(click.at - since), click.hz === ACCENT_HZ]);
    }

    /** At 100%, a click every 909 ms: the first `count` of them after `since`. */
    const everyBeat = (
      count: number,
      accented: (beat: number) => boolean = () => false,
    ) =>
      Array.from({ length: count }, (_, beat) => [
        Math.round(beat * msPerBeatAt(1)),
        accented(beat),
      ]);

    it('clicks from the moment Timed is chosen, a beat apart, none accented', async () => {
      await renderWithFakeTimers();
      const chosenAt = performance.now();

      fireEvent.click(screen.getByTestId('mode-timed'));
      advanceInSteps(2_000);

      expect(clicksFrom(chosenAt)).toEqual(everyBeat(3));
      expect(clicks.every((click) => click.hz === CLICK_HZ)).toBe(true);
    });

    it('is heard on the beat through slow speakers, from as soon as they can sound', async () => {
      outputLatency = 0.3; // Bluetooth: more than the lead a click is scheduled with
      await renderWithFakeTimers();
      const chosenAt = performance.now();

      fireEvent.click(screen.getByTestId('mode-timed'));
      advanceInSteps(2_000);

      expect(clicksFrom(chosenAt + 300)).toEqual(everyBeat(3));
    });

    it('starts the clock on the nearest click, and accents each bar from then', async () => {
      const { container } = await renderWithFakeTimers();
      const chosenAt = performance.now();
      fireEvent.click(screen.getByTestId('mode-timed'));

      advanceInSteps(300);
      playNote(67);
      // Snapped back onto the first click, A4's window closes 1591 ms after it, not
      // after the note.
      advanceInSteps(1_200);
      expect(expectedPitches(container)).toEqual([69]);
      advanceInSteps(100);
      expect(expectedPitches(container)).toEqual([67]);

      // Cicha Noc is in 3/4. The first click was sounded before the clock started.
      advanceInSteps(4_000);
      expect(clicksFrom(chosenAt)).toEqual(
        everyBeat(7, (beat) => beat > 0 && beat % 3 === 0),
      );
    });

    it('carries on unbroken, accents and all, through a one-bar loop’s wrap', async () => {
      await renderWithFakeTimers();
      fireEvent.click(screen.getByTestId('loop-enabled-checkbox'));
      fireEvent.change(screen.getByTestId('loop-end-input'), { target: { value: '1' } });
      const chosenAt = performance.now();
      fireEvent.click(screen.getByTestId('mode-timed'));

      // Bar 1 twice, in time: G4, A4 at 1½ beats, G4 at 2, and G4 again at 3.
      for (const [pitch, wait] of [
        [67, 0],
        [69, 1364],
        [67, 455],
        [67, 909],
        [69, 1364],
        [67, 455],
      ]) {
        advanceInSteps(wait);
        playNote(pitch);
      }
      advanceInSteps(1_000);

      expect(loadAttempts()).toMatchObject([{ notesPlayed: 6, wrongNoteCount: 0 }]);
      expect(clicksFrom(chosenAt)).toEqual(
        everyBeat(7, (beat) => beat > 0 && beat % 3 === 0),
      );
    });

    it('is silent with the checkbox cleared', async () => {
      await renderWithFakeTimers();
      chooseTimedWithoutMetronome();
      const clearedAt = performance.now();

      advanceInSteps(2_000);

      // Only the click sounded the instant Timed was chosen, before it was cleared.
      expect(clicks.filter((click) => click.at > clearedAt)).toEqual([]);
    });

    it('stops when Wait is chosen', async () => {
      await renderWithFakeTimers();
      fireEvent.click(screen.getByTestId('mode-timed'));
      // Past 809 ms, so the click due at 909 is already handed over and must be taken back.
      advanceInSteps(850);
      fireEvent.click(screen.getByTestId('mode-wait'));
      const waitAt = performance.now();

      advanceInSteps(2_000);

      expect(clicksFrom(waitAt)).toEqual([]);
    });

    it('is silent while Listen plays, and clicks again after Stop', async () => {
      await renderWithFakeTimers();
      fireEvent.click(screen.getByTestId('mode-timed'));
      advanceInSteps(850); // as above: the next click is already handed over

      await act(async () => {
        fireEvent.click(screen.getByTestId('listen-to-piece'));
      });
      const listenAt = performance.now();
      advanceInSteps(2_000);
      expect(clicksFrom(listenAt)).toEqual([]);

      fireEvent.click(screen.getByTestId('listen-to-piece'));
      const stoppedAt = performance.now();
      advanceInSteps(1_000);
      expect(clicksFrom(stoppedAt)).toEqual(everyBeat(2));
    });
  });
});
