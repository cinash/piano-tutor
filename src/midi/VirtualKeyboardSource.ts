import {
  createEventEmitter,
  type MidiEvent,
  type MidiSource,
  type Unsubscribe,
} from './types';

/**
 * Two piano-style rows of the QWERTY layout, keyed by KeyboardEvent.code so the
 * mapping is unaffected by locale or Shift state. Row 1 (Z..) covers one octave from
 * the base note; row 2 (Q..) carries on above it, overlapping by one note at the top of
 * row 1 / bottom of row 2 the way many DAW "typing keyboard" instruments do, and runs
 * to G5 — the highest note an offered piece asks for.
 */
const SEMITONE_OFFSET_BY_CODE: Readonly<Record<string, number>> = {
  KeyZ: 0,
  KeyS: 1,
  KeyX: 2,
  KeyD: 3,
  KeyC: 4,
  KeyV: 5,
  KeyG: 6,
  KeyB: 7,
  KeyH: 8,
  KeyN: 9,
  KeyJ: 10,
  KeyM: 11,
  Comma: 12,
  KeyQ: 12,
  Digit2: 13,
  KeyW: 14,
  Digit3: 15,
  KeyE: 16,
  KeyR: 17,
  Digit5: 18,
  KeyT: 19,
  Digit6: 20,
  KeyY: 21,
  Digit7: 22,
  KeyU: 23,
  KeyI: 24,
  Digit9: 25,
  KeyO: 26,
  Digit0: 27,
  KeyP: 28,
  BracketLeft: 29,
  Equal: 30,
  BracketRight: 31,
};

const BASE_NOTE = 48; // C3
const VIRTUAL_VELOCITY = 100;

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'number';
}

export class VirtualKeyboardSource implements MidiSource {
  private readonly emitter = createEventEmitter();
  private readonly heldCodes = new Set<string>();

  async start(): Promise<void> {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  stop(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.heldCodes.clear();
  }

  onEvent(handler: (e: MidiEvent) => void): Unsubscribe {
    return this.emitter.onEvent(handler);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    const note = this.noteForCode(event.code);
    if (note === undefined || this.heldCodes.has(event.code)) return;

    // See DECISIONS.md: don't play a note for a key typed into the loop's own fields.
    if (isTypingTarget(event.target)) return;

    this.heldCodes.add(event.code);
    this.emitter.emit({
      type: 'noteOn',
      note,
      velocity: VIRTUAL_VELOCITY,
      time: performance.now(),
    });
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    const note = this.noteForCode(event.code);
    if (note === undefined || !this.heldCodes.has(event.code)) return;

    this.heldCodes.delete(event.code);
    this.emitter.emit({ type: 'noteOff', note, time: performance.now() });
  };

  private noteForCode(code: string): number | undefined {
    const offset = SEMITONE_OFFSET_BY_CODE[code];
    return offset === undefined ? undefined : BASE_NOTE + offset;
  }
}
