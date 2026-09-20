import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FakeMidiInput,
  FakeMidiOutput,
  fakeMidiAccess,
  stubRequestMidiAccess,
} from './fakeMidiAccess';
import type { MidiEvent } from './types';
import {
  WebMidiSource,
  findMidiOutput,
  isWebMidiSupported,
  listMidiInputs,
} from './WebMidiSource';

/** Connects a WebMidiSource to a fresh fake input and starts collecting its events. */
async function connectedSource() {
  const input = new FakeMidiInput('id-1', 'Yamaha P-145');
  stubRequestMidiAccess(fakeMidiAccess({ inputs: [input] }));
  const source = new WebMidiSource('id-1');
  const received: MidiEvent[] = [];
  source.onEvent((e) => received.push(e));
  await source.start();
  return { input, source, received };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'requestMIDIAccess');
});

describe('isWebMidiSupported', () => {
  it('is false when navigator has no requestMIDIAccess', () => {
    expect(isWebMidiSupported()).toBe(false);
  });

  it('is true once requestMIDIAccess is stubbed in', () => {
    stubRequestMidiAccess(fakeMidiAccess());
    expect(isWebMidiSupported()).toBe(true);
  });
});

describe('listMidiInputs', () => {
  it('lists the available inputs by id, name and connection state', async () => {
    stubRequestMidiAccess(
      fakeMidiAccess({ inputs: [new FakeMidiInput('id-1', 'Yamaha P-145')] }),
    );

    await expect(listMidiInputs()).resolves.toEqual([
      { id: 'id-1', name: 'Yamaha P-145', state: 'connected' },
    ]);
  });
});

/**
 * The owner's host, as ALSA presents it: the kernel loopback alongside the instrument's
 * own two ports, all three surfaced to Web MIDI under the same names on the input side.
 * Three outputs rather than one is why the sole-output rule this replaced never fired.
 */
const hostOutputs = () =>
  ['Midi Through Port-0', 'Digital Piano MIDI 1', 'Digital Piano MIDI 2'].map(
    (name) => new FakeMidiOutput(name),
  );

describe('findMidiOutput', () => {
  it('opens and returns the output named after the input the player selected', async () => {
    const outputs = hostOutputs();
    stubRequestMidiAccess(fakeMidiAccess({ outputs }));

    const port = await findMidiOutput('Digital Piano MIDI 1');

    expect(port?.name).toBe('Digital Piano MIDI 1');
    expect(outputs.map((output) => output.opened)).toEqual([false, true, false]);
  });

  it('takes the other port of the same instrument when that is the one selected', async () => {
    stubRequestMidiAccess(fakeMidiAccess({ outputs: hostOutputs() }));

    const port = await findMidiOutput('Digital Piano MIDI 2');

    expect(port?.name).toBe('Digital Piano MIDI 2');
  });

  it('falls back to a piano port, never the loopback, when no device was selected', async () => {
    stubRequestMidiAccess(fakeMidiAccess({ outputs: hostOutputs() }));

    const port = await findMidiOutput(null);

    expect(port?.name).toBe('Digital Piano MIDI 1');
  });

  it('falls back the same way when no output carries the selected name', async () => {
    stubRequestMidiAccess(fakeMidiAccess({ outputs: hostOutputs() }));

    const port = await findMidiOutput('Some Other Piano');

    expect(port?.name).toBe('Digital Piano MIDI 1');
  });

  it('answers null when the loopback is the only output', async () => {
    const loopback = new FakeMidiOutput('Midi Through Port-0');
    stubRequestMidiAccess(fakeMidiAccess({ outputs: [loopback] }));

    await expect(findMidiOutput(null)).resolves.toBeNull();
    expect(loopback.opened).toBe(false);
  });

  it('answers null when the browser refuses MIDI access', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: () => Promise.reject(new Error('permission denied')),
      configurable: true,
    });

    await expect(findMidiOutput('Digital Piano MIDI 1')).resolves.toBeNull();
  });
});

describe('WebMidiSource', () => {
  it('translates a note-on message into a noteOn event', async () => {
    const { input, received } = await connectedSource();
    input.send([0x90, 60, 100], 1234);

    expect(received).toEqual([{ type: 'noteOn', note: 60, velocity: 100, time: 1234 }]);
  });

  it('translates a note-off message into a noteOff event', async () => {
    const { input, received } = await connectedSource();
    input.send([0x80, 60, 0], 1234);

    expect(received).toEqual([{ type: 'noteOff', note: 60, time: 1234 }]);
  });

  it('treats a note-on with velocity 0 as a noteOff, per the MIDI spec', async () => {
    const { input, received } = await connectedSource();
    input.send([0x90, 60, 0], 1234);

    expect(received).toEqual([{ type: 'noteOff', note: 60, time: 1234 }]);
  });

  it('ignores non-note messages', async () => {
    const { input, received } = await connectedSource();
    input.send([0xb0, 64, 127]); // sustain pedal (control change)

    expect(received).toEqual([]);
  });

  it('stops delivering events once stopped', async () => {
    const { input, source, received } = await connectedSource();
    source.stop();
    input.send([0x90, 60, 100]);

    expect(received).toEqual([]);
  });

  it('rejects when the requested device id is not present', async () => {
    stubRequestMidiAccess(fakeMidiAccess());
    const source = new WebMidiSource('missing');

    await expect(source.start()).rejects.toThrow('MIDI input not found: missing');
  });

  it('never attaches a listener if stop() is called while start() is still awaiting permission', async () => {
    const input = new FakeMidiInput('id-1', 'Yamaha P-145');
    let resolveAccess!: (access: unknown) => void;
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: vi.fn().mockReturnValue(new Promise((resolve) => (resolveAccess = resolve))),
      configurable: true,
    });

    const source = new WebMidiSource('id-1');
    const received: MidiEvent[] = [];
    source.onEvent((e) => received.push(e));

    const starting = source.start();
    source.stop();
    resolveAccess(fakeMidiAccess({ inputs: [input] }));
    await starting;

    input.send([0x90, 60, 100]);
    expect(received).toEqual([]);
    expect(input.listeners.size).toBe(0);
  });
});
