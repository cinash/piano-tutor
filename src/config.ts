export interface KeyboardPreset {
  readonly label: string;
  readonly low: number;
  readonly high: number;
}

/**
 * The on-screen keyboard's selectable widths, as an explicit list rather than a
 * computed span — see DECISIONS.md. Each preset's range comfortably contains
 * cicha-noc.musicxml's own C4-F5 range.
 */
export const KEYBOARD_PRESETS: readonly KeyboardPreset[] = [
  { label: '4 octaves', low: 36, high: 83 }, // C2-B5
  { label: '5 octaves', low: 36, high: 95 }, // C2-B6
  { label: '88 keys', low: 21, high: 108 }, // A0-C8, the P-145's own range
];

export const DEFAULT_KEYBOARD_PRESET = KEYBOARD_PRESETS[0];

export interface DemoSpeedPreset {
  readonly label: string;
  readonly speed: number;
}

/**
 * How fast the Listen demo plays, as fractions of DEMO_BPM rather than BPM values, so
 * they keep their meaning for a piece with another base tempo — see DECISIONS.md.
 */
export const DEMO_SPEED_PRESETS: readonly DemoSpeedPreset[] = [
  { label: '50%', speed: 0.5 },
  { label: '75%', speed: 0.75 },
  { label: '100%', speed: 1 },
  { label: '125%', speed: 1.25 },
  { label: '150%', speed: 1.5 },
];

export const DEFAULT_DEMO_SPEED = DEMO_SPEED_PRESETS[2];
