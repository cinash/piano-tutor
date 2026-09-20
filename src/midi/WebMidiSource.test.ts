import { afterEach, describe, expect, it, vi } from 'vitest';

import { FakeMidiInput, fakeMidiAccess, stubRequestMidiAccess } from './fakeMidiAccess';
import type { MidiEvent } from './types';
import { WebMidiSource, isWebMidiSupported, listMidiInputs } from './WebMidiSource';

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
