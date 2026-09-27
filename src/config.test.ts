import { describe, expect, it } from 'vitest';

import { KEYBOARD_PRESETS } from './config';
import { PIECES } from './score/pieces';

describe('KEYBOARD_PRESETS', () => {
  it.each(PIECES)('contains every pitch $id uses, in every preset', ({ score }) => {
    const pitches = score.events.flatMap((event) =>
      event.notes.map((note) => note.pitch),
    );

    for (const preset of KEYBOARD_PRESETS) {
      for (const pitch of pitches) {
        expect(pitch).toBeGreaterThanOrEqual(preset.low);
        expect(pitch).toBeLessThanOrEqual(preset.high);
      }
    }
  });
});
