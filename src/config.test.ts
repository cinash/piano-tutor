import { describe, expect, it } from 'vitest';

import { KEYBOARD_PRESETS } from './config';
import { cichaNocScore } from './score/cichaNoc';

describe('KEYBOARD_PRESETS', () => {
  it('contains every pitch cicha-noc.musicxml uses, in every preset', () => {
    const pitches = cichaNocScore.events.flatMap((event) =>
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
