/** Where the clicks fall: every `msPerBeat` from `origin`, in performance.now() time. */
export interface Grid {
  origin: number;
  msPerBeat: number;
}

/** Every `beatsPerBar`-th click from `firstBarStartTime`, a bar's first beat on the grid. */
export interface Accent {
  firstBarStartTime: number;
  beatsPerBar: number;
}

export const CLICK_HZ = 1000;
export const ACCENT_HZ = 1500;
const CLICK_SECONDS = 0.03;
// Each click is handed to the audio clock about this far ahead of its time.
const SCHEDULE_AHEAD_MS = 100;
const SCHEDULER_MS = 25;

/**
 * A click every quarter-note beat from the computer's speakers, each started at its exact
 * time on the audio clock so it is heard on the grid — see DECISIONS.md.
 */
export class Metronome {
  private context: AudioContext | null = null;
  private currentGrid: Grid | null = null;
  private accent: Accent | null = null;
  private nextBeat = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly scheduled = new Set<OscillatorNode>();

  get grid(): Grid | null {
    return this.currentGrid;
  }

  /**
   * Created or resumed from a click handler: a browser starts audio only after a user
   * gesture, and a note from the piano is not one.
   */
  wake(): void {
    void this.audio.resume();
  }

  /** Clicks at once, and every `msPerBeat` from then, on a grid of its own. */
  start(msPerBeat: number): void {
    this.stop();
    const grid = { origin: performance.now(), msPerBeat };
    this.currentGrid = grid;
    this.nextBeat = 0;
    this.scheduleAhead(grid);
  }

  /** Silent at once: a click already handed to the audio clock is stopped too. */
  stop(): void {
    clearTimeout(this.timer);
    for (const oscillator of this.scheduled) oscillator.stop();
    this.scheduled.clear();
    this.currentGrid = null;
  }

  /** Accents the bars' first beats from here on; null, no click is accented. */
  accentFrom(accent: Accent | null): void {
    this.accent = accent;
  }

  private get audio(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }

  private scheduleAhead(grid: Grid): void {
    const { origin, msPerBeat } = grid;
    while (origin + this.nextBeat * msPerBeat < performance.now() + SCHEDULE_AHEAD_MS) {
      this.click(origin + this.nextBeat * msPerBeat, msPerBeat);
      this.nextBeat++;
    }
    this.timer = setTimeout(() => this.scheduleAhead(grid), SCHEDULER_MS);
  }

  private click(at: number, msPerBeat: number): void {
    const { audio } = this;
    // Brought forward by the output's own delay, so the click is heard, not merely sent,
    // on the grid: on Bluetooth speakers that delay is about the width of the window.
    const when = Math.max(
      audio.currentTime,
      audio.currentTime + (at - performance.now()) / 1000 - (audio.outputLatency ?? 0),
    );
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.frequency.value = this.isAccented(at, msPerBeat) ? ACCENT_HZ : CLICK_HZ;
    envelope.gain.setValueAtTime(1, when);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + CLICK_SECONDS);
    oscillator.connect(envelope).connect(audio.destination);
    oscillator.onended = () => this.scheduled.delete(oscillator);
    this.scheduled.add(oscillator);
    oscillator.start(when);
    oscillator.stop(when + CLICK_SECONDS);
  }

  private isAccented(at: number, msPerBeat: number): boolean {
    if (!this.accent) return false;
    const beats = Math.round((at - this.accent.firstBarStartTime) / msPerBeat);
    return beats >= 0 && beats % this.accent.beatsPerBar === 0;
  }
}
