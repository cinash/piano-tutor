export interface KeyboardPreset {
  readonly label: string;
  readonly low: number;
  readonly high: number;
}

/**
 * The on-screen keyboard's selectable widths, as an explicit list rather than a
 * computed span — see DECISIONS.md. Each preset's range comfortably contains
 * cicha-noc.musicxml's own C3-G4 range.
 */
export const KEYBOARD_PRESETS: readonly KeyboardPreset[] = [
  { label: '4 octaves', low: 36, high: 83 }, // C2-B5
  { label: '5 octaves', low: 36, high: 95 }, // C2-B6
  { label: '88 keys', low: 21, high: 108 }, // A0-C8, the P-145's own range
];

export const DEFAULT_KEYBOARD_PRESET = KEYBOARD_PRESETS[0];
