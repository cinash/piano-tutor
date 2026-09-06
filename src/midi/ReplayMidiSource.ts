import {
  createEventEmitter,
  type MidiEvent,
  type MidiSource,
  type Unsubscribe,
} from './types';

export interface ReplayOptions {
  /**
   * true (default): schedule events at their recorded relative offsets, so a fixture
   * plays back at the same pace it was recorded — for e2e tests and manual review.
   * false: dispatch every event synchronously, for Layer 2 synthetic-performance tests
   * that want the end state without waiting.
   */
  realtime?: boolean;
}

export class ReplayMidiSource implements MidiSource {
  private readonly emitter = createEventEmitter();
  private readonly events: readonly MidiEvent[];
  private readonly realtime: boolean;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(events: readonly MidiEvent[], options: ReplayOptions = {}) {
    this.events = events;
    this.realtime = options.realtime ?? true;
  }

  async start(): Promise<void> {
    this.stop();
    if (this.events.length === 0) return;

    if (!this.realtime) {
      for (const event of this.events) this.emitter.emit(event);
      return;
    }

    const origin = this.events[0].time;
    this.timers = this.events.map((event) =>
      setTimeout(() => this.emitter.emit(event), event.time - origin),
    );
  }

  stop(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  onEvent(handler: (e: MidiEvent) => void): Unsubscribe {
    return this.emitter.onEvent(handler);
  }
}
