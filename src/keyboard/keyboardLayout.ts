export interface KeyLayout {
  note: number;
  color: 'white' | 'black';
  /** Left edge of the key, as a percentage of the whole keyboard's width. */
  leftPercent: number;
  /** Key width, as a percentage of the whole keyboard's width. */
  widthPercent: number;
}

const IS_WHITE_KEY_BY_PITCH_CLASS: readonly boolean[] = [
  true, // C
  false, // C#
  true, // D
  false, // D#
  true, // E
  true, // F
  false, // F#
  true, // G
  false, // G#
  true, // A
  false, // A#
  true, // B
];

const BLACK_KEY_WIDTH_RATIO = 0.6;

/**
 * Lays out an inclusive MIDI note range as a proportioned piano keyboard: white keys
 * of equal width in a row, black keys narrower and centered on the boundary between
 * the white keys either side of them.
 */
export function computeKeyboardLayout(lowNote: number, highNote: number): KeyLayout[] {
  if (highNote < lowNote) {
    throw new Error(`highNote (${highNote}) must be >= lowNote (${lowNote})`);
  }

  let whiteKeyCount = 0;
  for (let note = lowNote; note <= highNote; note++) {
    if (isWhiteKey(note)) whiteKeyCount++;
  }
  if (whiteKeyCount === 0) {
    throw new Error(
      `Range ${lowNote}-${highNote} contains no white key to anchor a keyboard on`,
    );
  }
  const whiteWidthPercent = 100 / whiteKeyCount;
  const blackWidthPercent = whiteWidthPercent * BLACK_KEY_WIDTH_RATIO;

  const layout: KeyLayout[] = [];
  let whiteIndex = 0;

  for (let note = lowNote; note <= highNote; note++) {
    if (isWhiteKey(note)) {
      layout.push({
        note,
        color: 'white',
        leftPercent: whiteIndex * whiteWidthPercent,
        widthPercent: whiteWidthPercent,
      });
      whiteIndex++;
    } else {
      layout.push({
        note,
        color: 'black',
        leftPercent: whiteIndex * whiteWidthPercent - blackWidthPercent / 2,
        widthPercent: blackWidthPercent,
      });
    }
  }

  return layout;
}

function isWhiteKey(note: number): boolean {
  return IS_WHITE_KEY_BY_PITCH_CLASS[((note % 12) + 12) % 12];
}
