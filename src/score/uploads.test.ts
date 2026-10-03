import { describe, expect, it } from 'vitest';

import { DEFAULT_KEYBOARD_PRESET } from '../config';
import {
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  checkUpload,
  type Accepted,
  type UploadContext,
} from './uploads';
import {
  COMPUTER_KEYBOARD_HIGH,
  COMPUTER_KEYBOARD_LOW,
  hasPitchOutside,
  timedPlayable,
} from './pieceRules';
import {
  FINGERED_BAR,
  LEFT_WHOLE,
  QUARTER,
  attributes,
  backup,
  leftHand,
  note,
  repeatNote,
  rest,
  scoreXml,
  twoHands,
} from './fixtures/uploads/scoreXml';

const context: UploadContext = {
  bundledTitles: ['Cicha Noc', 'Beyer Op. 101 No. 8'],
  storedTitles: [],
  storedBytes: 0,
};

function check(
  xml: string,
  fileName = 'upload.musicxml',
  overrides: Partial<UploadContext> = {},
) {
  return checkUpload(new TextEncoder().encode(xml), fileName, {
    ...context,
    ...overrides,
  });
}

/** The accepted result, or a failure that names the refusal. */
function accepted(xml: string, fileName?: string): Accepted {
  const result = check(xml, fileName);
  if (!result.ok) throw new Error(`expected acceptance, got: ${result.message}`);
  return result;
}

describe('checkUpload refusals, in the brief’s order', () => {
  it('refuses a compressed .mxl by its content, not its name', () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);

    expect(checkUpload(zip, 'tune.xml', context)).toEqual({
      ok: false,
      message: 'Compressed .mxl is not supported yet. Export uncompressed MusicXML.',
    });
  });

  it('refuses a file over 1 MB before reading it', () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);

    expect(checkUpload(big, 'big.musicxml', context)).toEqual({
      ok: false,
      message: 'This file is larger than 1 MB.',
    });
  });

  it('refuses a file that would take the stored total past 2 MB', () => {
    expect(
      check(scoreXml({ bars: [FINGERED_BAR] }), 'tune.musicxml', {
        storedBytes: MAX_TOTAL_BYTES,
      }),
    ).toEqual({
      ok: false,
      message:
        "Browser storage for your pieces is full. To make room, download your progress first, then clear the site's data.",
    });
  });

  it.each([
    ['an unparseable file', '<not xml', /not readable MusicXML/],
    ['a file with no note', scoreXml({ bars: [rest(48)] }), /no notes/],
    [
      'a title that clashes with a bundled piece, in other case and with spaces',
      scoreXml({ title: '  cicha NOC ', bars: [FINGERED_BAR] }),
      /already built in/,
    ],
    [
      'a pickup bar',
      scoreXml({
        bars: [
          note('C', 4, QUARTER, { finger: '1' }) + backup(QUARTER) + leftHand(QUARTER),
          FINGERED_BAR,
        ],
      }),
      /Measure 1 is short/,
    ],
    [
      'a short bar in the middle of the piece',
      scoreXml({
        bars: [
          FINGERED_BAR,
          twoHands(note('C', 4, 36, { finger: '1' }), LEFT_WHOLE),
          FINGERED_BAR,
        ],
      }),
      /Measure 2 is short/,
    ],
    [
      'a left hand that is short while the right hand is full',
      scoreXml({
        bars: [twoHands(repeatNote(4, QUARTER), leftHand(36))],
      }),
      /Measure 1 is short/,
    ],
    [
      'a forward with no staff, which counts on staff 1 and leaves staff 2 short',
      scoreXml({
        bars: [
          twoHands(
            repeatNote(4, QUARTER),
            leftHand(24) + '<forward><duration>24</duration></forward>',
          ),
        ],
      }),
      /Measure 1 is short/,
    ],
    [
      'an overlong bar',
      scoreXml({ bars: [twoHands(note('C', 4, 60, { finger: '1' }), LEFT_WHOLE)] }),
      /Measure 1 is longer/,
    ],
    [
      'two parts',
      scoreXml({
        bars: [FINGERED_BAR],
        extraParts: '<part id="P2"><measure number="1"/></part>',
      }),
      /two parts/,
    ],
    [
      'a single staff',
      scoreXml({
        attributes: attributes(4, 4, 1),
        bars: [repeatNote(4, QUARTER), repeatNote(4, QUARTER)],
      }),
      /one staff/,
    ],
    [
      'a repeat, naming its bar',
      scoreXml({
        bars: [
          FINGERED_BAR,
          '<barline location="left"><repeat direction="forward"/></barline>' +
            FINGERED_BAR,
        ],
      }),
      /Measure 2 has a repeat/,
    ],
    [
      'a D.C. jump',
      scoreXml({
        bars: [
          FINGERED_BAR,
          '<direction><sound dacapo="yes"/></direction>' + FINGERED_BAR,
        ],
      }),
      /Measure 2 has a jump or a coda/,
    ],
    [
      'a coda',
      scoreXml({ bars: [FINGERED_BAR, '<coda/>' + FINGERED_BAR] }),
      /Measure 2 has a jump or a coda/,
    ],
    [
      'a divisions change after the first bar',
      scoreXml({
        bars: [
          FINGERED_BAR,
          '<attributes><divisions>24</divisions></attributes>' + FINGERED_BAR,
        ],
      }),
      /Measure 2 changes the divisions/,
    ],
    [
      'a key change after the first bar',
      scoreXml({
        bars: [
          FINGERED_BAR,
          '<attributes><key><fifths>1</fifths></key></attributes>' + FINGERED_BAR,
        ],
      }),
      /Measure 2 sets the key again/,
    ],
    [
      'a note with no finger',
      scoreXml({
        bars: [
          twoHands(note('C', 4, QUARTER) + note('D', 4, 36, { finger: '2' }), LEFT_WHOLE),
        ],
      }),
      /Measure 1 has a note with no finger/,
    ],
  ])('refuses %s', (_name, xml, message) => {
    expect(check(xml)).toEqual({ ok: false, message: expect.stringMatching(message) });
  });

  it.each(['0', '6', '3-4'])(
    'refuses a finger of %s, which is not on the keyboard',
    (finger) => {
      const xml = scoreXml({
        bars: [twoHands(note('C', 4, 48, { finger }), LEFT_WHOLE)],
      });

      expect(check(xml)).toEqual({
        ok: false,
        message: 'Measure 1 has a note with no finger (1 to 5).',
      });
    },
  );

  it('refuses a title that matches an upload already stored', () => {
    expect(
      check(scoreXml({ title: 'test tune', bars: [FINGERED_BAR] }), 'x.musicxml', {
        storedTitles: ['Test Tune'],
      }),
    ).toEqual({
      ok: false,
      message:
        'A piece with this name is already uploaded; give the file a different title.',
    });
  });
});

describe('checkUpload accepts', () => {
  it('a fingered two-hand piece in 4/4, which timed play can keep time through', () => {
    const result = accepted(scoreXml({ bars: [FINGERED_BAR, FINGERED_BAR] }));

    expect(result.title).toBe('Test Tune');
    expect(timedPlayable(result.score)).toBe(true);
    expect(
      hasPitchOutside(result.score, COMPUTER_KEYBOARD_LOW, COMPUTER_KEYBOARD_HIGH),
    ).toBe(false);
  });

  it('a bar whose left hand ends with a forward that fills the rest of the bar', () => {
    const leftWithGap =
      leftHand(24) + '<forward><duration>24</duration><staff>2</staff></forward>';

    expect(
      accepted(scoreXml({ bars: [twoHands(repeatNote(4, QUARTER), leftWithGap)] })).title,
    ).toBe('Test Tune');
  });

  it('a file with a .xml extension, because the content decides', () => {
    expect(accepted(scoreXml({ bars: [FINGERED_BAR] }), 'tune.xml').title).toBe(
      'Test Tune',
    );
  });

  it('a file with no title, naming it from the file name', () => {
    expect(
      accepted(scoreXml({ title: '', bars: [FINGERED_BAR] }), 'Kotek.musicxml').title,
    ).toBe('Kotek');
  });

  it('a note outside C3 to G5, which is outside the computer keyboard’s range', () => {
    const result = accepted(
      scoreXml({ bars: [twoHands(note('C', 2, 48, { finger: '1' }), LEFT_WHOLE)] }),
    );

    expect(
      hasPitchOutside(result.score, COMPUTER_KEYBOARD_LOW, COMPUTER_KEYBOARD_HIGH),
    ).toBe(true);
    expect(
      hasPitchOutside(
        result.score,
        DEFAULT_KEYBOARD_PRESET.low,
        DEFAULT_KEYBOARD_PRESET.high,
      ),
    ).toBe(false);
  });

  it('a note outside even the on-screen preset’s range', () => {
    const result = accepted(
      scoreXml({ bars: [twoHands(note('C', 1, 48, { finger: '1' }), LEFT_WHOLE)] }),
    );

    expect(
      hasPitchOutside(
        result.score,
        DEFAULT_KEYBOARD_PRESET.low,
        DEFAULT_KEYBOARD_PRESET.high,
      ),
    ).toBe(true);
  });

  it('a bass staff that only rests, because a one-handed piece is common', () => {
    const bar = twoHands(repeatNote(4, QUARTER), rest(48, 2));

    expect(accepted(scoreXml({ bars: [bar] })).title).toBe('Test Tune');
  });

  it('a bar with nothing on staff 2, because only a staff with content must fill the bar', () => {
    const rightOnly = repeatNote(4, QUARTER);

    expect(
      accepted(scoreXml({ bars: [FINGERED_BAR, rightOnly, FINGERED_BAR] })).title,
    ).toBe('Test Tune');
  });

  it.each([
    ['6/8', attributes(6, 8), twoHands(repeatNote(6, 6), leftHand(36), 36)],
    ['2/2', attributes(2, 2), FINGERED_BAR],
    ['3/8', attributes(3, 8), twoHands(repeatNote(3, 6), leftHand(18), 18)],
    ['sixteenth notes', attributes(4, 4), twoHands(repeatNote(16, 3), LEFT_WHOLE)],
    ['triplet eighths', attributes(4, 4), twoHands(repeatNote(12, 4), LEFT_WHOLE)],
  ])('%s, marked wait-only rather than refused', (_name, opening, bar) => {
    expect(
      timedPlayable(accepted(scoreXml({ attributes: opening, bars: [bar] })).score),
    ).toBe(false);
  });

  it('a mid-piece time change is accepted, and marked wait-only', () => {
    const threeFour = twoHands(repeatNote(3, QUARTER), leftHand(36), 36);
    const result = accepted(
      scoreXml({
        bars: [
          FINGERED_BAR,
          '<attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>' +
            threeFour,
        ],
      }),
    );

    expect(timedPlayable(result.score)).toBe(false);
  });
});
