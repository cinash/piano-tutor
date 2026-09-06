export type Unsubscribe = () => void;

export type MidiEvent =
  | { type: 'noteOn'; note: number; velocity: number; time: number }
  | { type: 'noteOff'; note: number; time: number };

export interface MidiSource {
  start(): Promise<void>;
  stop(): void;
  onEvent(handler: (e: MidiEvent) => void): Unsubscribe;
}

/**
 * Every MidiSource has exactly one subscriber in this app (App wires each source to
 * a single handler once), so this holds one handler slot rather than a Set — simpler,
 * and still satisfies onEvent's Unsubscribe contract.
 */
export function createEventEmitter() {
  let handler: ((e: MidiEvent) => void) | null = null;
  return {
    onEvent(next: (e: MidiEvent) => void): Unsubscribe {
      handler = next;
      return () => {
        if (handler === next) handler = null;
      };
    },
    emit(event: MidiEvent): void {
      handler?.(event);
    },
  };
}
