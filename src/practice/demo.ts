import { findMidiOutput } from '../midi/WebMidiSource';
import type { Score } from '../score/types';

/**
 * The piece carries no tempo mark, so the demo picks one: a shade slower than a
 * performance, because it is showing the player what to play. Not in config.ts, which
 * holds the player-configurable presets — see DECISIONS.md.
 */
export const DEMO_BPM = 66;

/** One velocity for every note: dynamics are out of scope. */
const DEMO_VELOCITY = 80;

const NOTHING: ReadonlySet<number> = new Set();

/** What sounds from `atMs` until the next step falls due; an empty set is silence. */
export interface DemoStep {
  /** When the step falls due, in milliseconds from the start of the demo. */
  atMs: number;
  /** Where it is in the score, in quarter-note beats — what the staff cursor marks. */
  startTime: number;
  pitches: ReadonlySet<number>;
}

/**
 * One step per event, at its own onset, plus the silences between them. A ReadonlySet
 * because it is handed straight to PianoKeyboard's heldNotes.
 */
export function buildDemoSchedule(score: Score, bpm: number): DemoStep[] {
  const msPerBeat = 60000 / bpm;
  const steps: DemoStep[] = [];

  score.events.forEach((event, index) => {
    // Infinity past the last event, so that one is closed by the same arithmetic.
    const nextStartTime = score.events[index + 1]?.startTime ?? Infinity;
    const endTime = event.startTime + event.durationBeats;

    steps.push({
      atMs: event.startTime * msPerBeat,
      startTime: event.startTime,
      pitches: new Set(event.notes.map((note) => note.pitch)),
    });
    // Only a real gap needs a step of silence: where this event instead overruns the
    // next — a chord under a moving melody — the next step's note-offs end it, which
    // is what sounds one event at a time. parseScore drops rests, so the gap itself
    // survives only as this arithmetic.
    if (endTime < nextStartTime) {
      // At the event's end, so the cursor moves off the note that has stopped sounding
      // and onto whatever the score writes there — the rest itself, where there is one.
      steps.push({ atMs: endTime * msPerBeat, startTime: endTime, pitches: NOTHING });
    }
  });

  return steps;
}

/**
 * Plays a schedule out of the piano's MIDI output, reporting each step as it falls due —
 * what is sounding and where in the piece it is — and reporting null when the schedule
 * runs out, which is how the demo ends.
 *
 * Messages are sent as each step falls due rather than scheduled ahead with
 * `send(data, timestamp)`: Web MIDI cannot cancel a scheduled message, so a stopped or
 * unplugged demo would keep playing out of the instrument. See DECISIONS.md.
 */
export class DemoPlayer {
  private readonly steps: readonly DemoStep[];
  // The piano the player selected, matched by name to the output to play through.
  private readonly deviceName: string | null;
  private readonly onStep: (step: DemoStep | null) => void;
  private output: MIDIOutput | null = null;
  private sounding: ReadonlySet<number> = NOTHING;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private startedAt = 0;
  // start() awaits the port lookup before it can play anything; if stop() runs during
  // that wait, this tells the resumed start() to stay silent.
  private stopped = false;

  constructor(
    steps: readonly DemoStep[],
    deviceName: string | null,
    onStep: (step: DemoStep | null) => void,
  ) {
    this.steps = steps;
    this.deviceName = deviceName;
    this.onStep = onStep;
  }

  /** A null output plays the schedule silently; the highlighting is not optional. */
  async start(): Promise<void> {
    const output = await findMidiOutput(this.deviceName);
    if (this.stopped) return;

    this.output = output;
    this.startedAt = Date.now();
    this.play(0);
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.silence();
  }

  private play(index: number): void {
    const step = this.steps[index];
    // Note-off before note-on at every boundary, including for a pitch in both steps:
    // the melody repeats notes, and on-before-off would silence the new one instead.
    this.silence();
    for (const pitch of step.pitches) {
      this.output?.send([0x90, pitch, DEMO_VELOCITY]);
    }
    this.sounding = step.pitches;

    const next = this.steps[index + 1];
    if (!next) {
      this.onStep(null);
      return;
    }
    this.onStep(step);
    // Timed from the start rather than step to step, so a late timer doesn't push the
    // rest of the piece back with it.
    this.timer = setTimeout(
      () => this.play(index + 1),
      this.startedAt + next.atMs - Date.now(),
    );
  }

  private silence(): void {
    for (const pitch of this.sounding) {
      this.output?.send([0x80, pitch, 0]);
    }
    this.sounding = NOTHING;
  }
}
