import { describe, expect, it } from 'vitest';

import {
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  checkUpload,
  type UploadContext,
} from './uploads';
import {
  FINGERED_BAR,
  QUARTER,
  backup,
  note,
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

function attributes(beats: number, beatType: number, staves = 2): string {
  return (
    '<attributes><divisions>12</divisions><key><fifths>0</fifths></key>' +
    `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
    `<staves>${staves}</staves></attributes>`
  );
}

const quarters = (count: number, finger = '1') =>
  Array.from({ length: count }, () => note('C', 4, QUARTER, { finger })).join('');

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

    expect(checkUpload(big, 'big.musicxml', context)).toMatchObject({
      ok: false,
      message: 'This file is larger than 1 MB.',
    });
  });

  it('refuses a file that would take the stored total past 2 MB', () => {
    const result = check(scoreXml({ bars: [FINGERED_BAR] }), 'tune.musicxml', {
      storedBytes: MAX_TOTAL_BYTES,
    });

    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining('storage'),
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
          note('C', 4, QUARTER, { finger: '1' }) +
            backup(QUARTER) +
            note('C', 3, QUARTER, { staff: 2, finger: '5' }),
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
          twoHands(
            note('C', 4, 36, { finger: '1' }),
            note('C', 3, 48, { staff: 2, finger: '5' }),
          ),
          FINGERED_BAR,
        ],
      }),
      /Measure 2 is short/,
    ],
    [
      'an overlong bar',
      scoreXml({
        bars: [
          twoHands(
            note('C', 4, 60, { finger: '1' }),
            note('C', 3, 48, { staff: 2, finger: '5' }),
          ),
        ],
      }),
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
      scoreXml({ attributes: attributes(4, 4, 1), bars: [quarters(4), quarters(4)] }),
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
          twoHands(
            note('C', 4, QUARTER) + note('D', 4, 36, { finger: '2' }),
            note('C', 3, 48, { staff: 2, finger: '5' }),
          ),
        ],
      }),
      /Measure 1 has a note with no finger/,
    ],
    [
      'a finger of 0',
      scoreXml({
        bars: [
          twoHands(
            note('C', 4, 48, { finger: '0' }),
            note('C', 3, 48, { staff: 2, finger: '5' }),
          ),
        ],
      }),
      /no finger/,
    ],
    [
      'a finger of 6',
      scoreXml({
        bars: [
          twoHands(
            note('C', 4, 48, { finger: '6' }),
            note('C', 3, 48, { staff: 2, finger: '5' }),
          ),
        ],
      }),
      /no finger/,
    ],
    [
      'a finger written as a range',
      scoreXml({
        bars: [
          twoHands(
            note('C', 4, 48, { finger: '3-4' }),
            note('C', 3, 48, { staff: 2, finger: '5' }),
          ),
        ],
      }),
      /no finger/,
    ],
  ])('refuses %s', (_name, xml, message) => {
    const result = check(xml);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(message);
  });

  it('refuses a title that matches an upload already stored', () => {
    expect(
      check(scoreXml({ title: 'test tune', bars: [FINGERED_BAR] }), 'x.musicxml', {
        storedTitles: ['Test Tune'],
      }),
    ).toMatchObject({
      ok: false,
      message:
        'A piece with this name is already uploaded; give the file a different title.',
    });
  });
});

describe('checkUpload accepts', () => {
  it('a fingered two-hand piece in 4/4, which timed play can keep time through', () => {
    expect(check(scoreXml({ bars: [FINGERED_BAR, FINGERED_BAR] }))).toMatchObject({
      ok: true,
      title: 'Test Tune',
      waitOnly: false,
      outsideKeyboard: false,
      outsidePreset: false,
    });
  });

  it('a file with a .xml extension, because the content decides', () => {
    expect(check(scoreXml({ bars: [FINGERED_BAR] }), 'tune.xml')).toMatchObject({
      ok: true,
    });
  });

  it('takes the title from the file name when the file has no title', () => {
    expect(
      check(scoreXml({ title: '', bars: [FINGERED_BAR] }), 'Kotek.musicxml'),
    ).toMatchObject({
      ok: true,
      title: 'Kotek',
    });
  });

  it('a note outside C3 to G5 is accepted, with the keyboard warning', () => {
    const bar = twoHands(
      note('C', 2, 48, { finger: '1' }),
      note('C', 3, 48, { staff: 2, finger: '5' }),
    );

    expect(check(scoreXml({ bars: [bar] }))).toMatchObject({
      ok: true,
      outsideKeyboard: true,
      outsidePreset: false,
    });
  });

  it('a note outside even the on-screen preset gets the second warning', () => {
    const bar = twoHands(
      note('C', 1, 48, { finger: '1' }),
      note('C', 3, 48, { staff: 2, finger: '5' }),
    );

    expect(check(scoreXml({ bars: [bar] }))).toMatchObject({
      ok: true,
      outsideKeyboard: true,
      outsidePreset: true,
    });
  });

  it('a bass staff that only rests, because a one-handed piece is common', () => {
    const bar = twoHands(
      quarters(4),
      '<note><rest/><duration>48</duration><staff>2</staff></note>',
    );

    expect(check(scoreXml({ bars: [bar] }))).toMatchObject({ ok: true });
  });

  it.each([
    [
      '6/8',
      attributes(6, 8),
      twoHands(
        Array.from({ length: 6 }, () => note('C', 4, 6, { finger: '1' })).join(''),
        note('C', 3, 36, { staff: 2, finger: '5' }),
        36,
      ),
    ],
    ['2/2', attributes(2, 2), FINGERED_BAR],
    [
      '3/8',
      attributes(3, 8),
      twoHands(
        Array.from({ length: 3 }, () => note('C', 4, 6, { finger: '1' })).join(''),
        note('C', 3, 18, { staff: 2, finger: '5' }),
        18,
      ),
    ],
    [
      'sixteenth notes',
      attributes(4, 4),
      twoHands(
        Array.from({ length: 16 }, () => note('C', 4, 3, { finger: '1' })).join(''),
        note('C', 3, 48, { staff: 2, finger: '5' }),
      ),
    ],
    [
      'triplet eighths',
      attributes(4, 4),
      twoHands(
        Array.from({ length: 12 }, () => note('C', 4, 4, { finger: '1' })).join(''),
        note('C', 3, 48, { staff: 2, finger: '5' }),
      ),
    ],
  ])('accepts %s as wait-only, not refused', (_name, attrs, bar) => {
    expect(check(scoreXml({ attributes: attrs, bars: [bar] }))).toMatchObject({
      ok: true,
      waitOnly: true,
    });
  });

  it('a mid-piece time change is accepted as wait-only', () => {
    const threeFour = twoHands(
      Array.from({ length: 3 }, () => note('C', 4, QUARTER, { finger: '1' })).join(''),
      note('C', 3, 36, { staff: 2, finger: '5' }),
      36,
    );

    expect(
      check(
        scoreXml({
          bars: [
            FINGERED_BAR,
            '<attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>' +
              threeFour,
          ],
        }),
      ),
    ).toMatchObject({ ok: true, waitOnly: true });
  });
});
