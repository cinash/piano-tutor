/**
 * The on-screen keyboard's range, in MIDI note numbers. Hardcoded to match
 * cicha-noc.musicxml (C3-G4) until step 2 derives it from the parsed score.
 */
export const KEYBOARD_RANGE = { low: 48, high: 67 } as const;
