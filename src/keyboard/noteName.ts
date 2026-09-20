const NAME_BY_PITCH_CLASS = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
];

/**
 * Names a MIDI note in scientific pitch notation, with middle C (60) as C4 — the
 * convention config.ts already used when it called 48 "C3". Sharps only, because the
 * parser discards the score's spelling; see DECISIONS.md.
 */
export function noteName(pitch: number): string {
  return `${NAME_BY_PITCH_CLASS[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}
