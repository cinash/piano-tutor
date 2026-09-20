import {
  createEventEmitter,
  type MidiEvent,
  type MidiSource,
  type Unsubscribe,
} from './types';

export interface MidiInputDescriptor {
  id: string;
  name: string;
  state: MIDIPortDeviceState;
}

export function isWebMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

async function getMidiAccess(): Promise<MIDIAccess> {
  if (!isWebMidiSupported()) {
    throw new Error('This browser does not support the Web MIDI API.');
  }
  // Sysex is never requested: note on/off is all this app needs, and the sysex
  // permission prompt is more intrusive than the feature is worth.
  return navigator.requestMIDIAccess({ sysex: false });
}

export async function listMidiInputs(): Promise<MidiInputDescriptor[]> {
  const access = await getMidiAccess();
  return Array.from(access.inputs.values()).map((input) => ({
    id: input.id,
    name: input.name ?? input.id,
    state: input.state,
  }));
}

/**
 * The port to play the demo through, or null when there is nothing to play through: no
 * Web MIDI, a permission the player denied — which is what every Playwright run is — or
 * no output port at all. The demo runs silently on a null, so nothing downstream asks
 * which of those it was, and none of them is an error to report.
 */
export async function findMidiOutput(): Promise<MIDIOutput | null> {
  try {
    const access = await getMidiAccess();
    const outputs = Array.from(access.outputs.values());
    // One output port is taken to be the piano's own. Several — a soft synth, a
    // loopback bus — are an ambiguity this app does not resolve: it asks the player
    // for their piano once, in the input dropdown, and adds no second one.
    if (outputs.length !== 1) return null;
    await outputs[0].open();
    return outputs[0];
  } catch {
    return null;
  }
}

/** Notifies the handler whenever a MIDI device is plugged in or unplugged. */
export async function subscribeToMidiInputChanges(
  handler: () => void,
): Promise<Unsubscribe> {
  const access = await getMidiAccess();
  const listener = () => handler();
  access.addEventListener('statechange', listener);
  return () => access.removeEventListener('statechange', listener);
}

export class WebMidiSource implements MidiSource {
  private readonly emitter = createEventEmitter();
  private readonly deviceId: string;
  private input: MIDIInput | null = null;
  // start() awaits browser permission before it can attach anything; if stop() runs
  // during that wait, this tells the resumed start() to bail instead of attaching a
  // listener nothing will ever remove.
  private stopped = false;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  async start(): Promise<void> {
    this.stopped = false;
    const access = await getMidiAccess();
    if (this.stopped) return;

    const input = access.inputs.get(this.deviceId);
    if (!input) {
      throw new Error(`MIDI input not found: ${this.deviceId}`);
    }
    await input.open();
    if (this.stopped) {
      void input.close();
      return;
    }

    this.input = input;
    input.addEventListener('midimessage', this.handleMessage);
  }

  stop(): void {
    this.stopped = true;
    this.input?.removeEventListener('midimessage', this.handleMessage);
    void this.input?.close();
    this.input = null;
  }

  onEvent(handler: (e: MidiEvent) => void): Unsubscribe {
    return this.emitter.onEvent(handler);
  }

  private handleMessage = (message: MIDIMessageEvent): void => {
    const data = message.data;
    if (!data || data.length < 3) return;

    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];
    const time = message.timeStamp;

    if (status === 0x90 && velocity > 0) {
      this.emitter.emit({ type: 'noteOn', note, velocity, time });
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      this.emitter.emit({ type: 'noteOff', note, time });
    }
  };
}
