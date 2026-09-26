/**
 * The Web MIDI port boundary, faked: the access object `navigator.requestMIDIAccess`
 * resolves to, with whatever ports a test needs hanging off it. Shared so that the app
 * is tested against one fake piano rather than one per test file.
 */

export class FakeMidiInput {
  listeners = new Map<string, (event: { data: Uint8Array; timeStamp: number }) => void>();
  id: string;
  name: string;
  state: 'connected' | 'disconnected' = 'connected';

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  closed = false;

  async open() {
    return this;
  }

  async close() {
    this.closed = true;
    return this;
  }

  addEventListener(
    type: string,
    listener: (event: { data: Uint8Array; timeStamp: number }) => void,
  ) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string) {
    this.listeners.delete(type);
  }

  send(data: number[], timeStamp = 0) {
    this.listeners.get('midimessage')?.({ data: Uint8Array.from(data), timeStamp });
  }
}

/** Keeps every message it is sent, in order, for a test to read back. */
export class FakeMidiOutput {
  // Outputs are found by name, so the name is identity enough to key the map by.
  readonly id: string;
  readonly name: string;
  opened = false;
  sent: number[][] = [];

  constructor(name: string) {
    this.id = name;
    this.name = name;
  }

  async open() {
    this.opened = true;
    return this;
  }

  send(data: number[]) {
    this.sent.push(data);
  }
}

const byId = <T extends { id: string }>(ports: readonly T[]) =>
  new Map(ports.map((port) => [port.id, port]));

export function fakeMidiAccess(
  ports: { inputs?: readonly FakeMidiInput[]; outputs?: readonly FakeMidiOutput[] } = {},
) {
  // App watches statechange to keep its device list current. A test plugs a device in or
  // out by setting an input's state, then calling fireStateChange().
  const listeners = new Set<() => void>();
  return {
    inputs: byId(ports.inputs ?? []),
    outputs: byId(ports.outputs ?? []),
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener);
    },
    fireStateChange() {
      for (const listener of listeners) listener();
    },
  };
}

export function stubRequestMidiAccess(access: unknown) {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: () => Promise.resolve(access),
    configurable: true,
  });
}
