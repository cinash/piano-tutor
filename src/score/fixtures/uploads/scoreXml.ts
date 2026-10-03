/**
 * Builds MusicXML for the upload validator's fixtures. Each test states the one thing it varies,
 * so a refusal is traceable to the line that caused it. Divisions are 12 per quarter note.
 */

export const QUARTER = 12;

export const DEFAULT_ATTRIBUTES =
  '<attributes><divisions>12</divisions><key><fifths>0</fifths></key>' +
  '<time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>';

export function note(
  step: string,
  octave: number,
  duration: number,
  options: { staff?: number; finger?: string } = {},
): string {
  const { staff = 1, finger } = options;
  const fingering = finger
    ? `<notations><technical><fingering>${finger}</fingering></technical></notations>`
    : '';
  return (
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch>` +
    `<duration>${duration}</duration><staff>${staff}</staff>${fingering}</note>`
  );
}

export function rest(duration: number, staff = 1): string {
  return `<note><rest/><duration>${duration}</duration><staff>${staff}</staff></note>`;
}

export function backup(duration: number): string {
  return `<backup><duration>${duration}</duration></backup>`;
}

/** Right hand on staff 1, then back to the start of the bar for the left hand on staff 2. */
export function twoHands(right: string, left: string, length = 48): string {
  return right + backup(length) + left;
}

export interface ScoreOptions {
  title?: string;
  /** Inserted at the start of the first bar. */
  attributes?: string;
  /** One string of inner XML per bar. */
  bars: string[];
  /** Extra `<part>` elements, for a two-part score. */
  extraParts?: string;
}

export function scoreXml({
  title = 'Test Tune',
  attributes = DEFAULT_ATTRIBUTES,
  bars,
  extraParts = '',
}: ScoreOptions): string {
  const measures = bars
    .map(
      (bar, i) =>
        `<measure number="${i + 1}">${i === 0 ? attributes : ''}${bar}</measure>`,
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="3.1">' +
    `<work><work-title>${title}</work-title></work>` +
    `<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>` +
    `<part id="P1">${measures}</part>${extraParts}` +
    '</score-partwise>'
  );
}

/** Four fingered quarter notes in the right hand, a fingered whole note in the left: one 4/4 bar. */
export const FINGERED_BAR = twoHands(
  note('C', 4, QUARTER, { finger: '1' }) +
    note('D', 4, QUARTER, { finger: '2' }) +
    note('E', 4, QUARTER, { finger: '3' }) +
    note('F', 4, QUARTER, { finger: '4' }),
  note('C', 3, 48, { staff: 2, finger: '5' }),
);
