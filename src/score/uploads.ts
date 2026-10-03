import {
  COMPUTER_KEYBOARD_HIGH,
  COMPUTER_KEYBOARD_LOW,
  DEFAULT_PRESET_HIGH,
  DEFAULT_PRESET_LOW,
  isFingered,
  timedPlayable,
} from './pieceRules';
import { parseScore } from './parseScore';
import type { Score } from './types';

export const MAX_FILE_BYTES = 1_000_000;
export const MAX_TOTAL_BYTES = 2_000_000;

const STORAGE_FULL =
  'Browser storage for your pieces is full. To make room, download your progress first, then clear the site’s data.';

export interface UploadContext {
  bundledTitles: readonly string[];
  storedTitles: readonly string[];
  /** The UTF-8 bytes of every stored record's XML, summed. */
  storedBytes: number;
}

export interface Accepted {
  ok: true;
  xml: string;
  title: string;
  score: Score;
  /** Timed mode cannot keep time through this piece; it plays in Wait mode only. */
  waitOnly: boolean;
  /** Some note is off the computer keyboard (C3 to G5). */
  outsideKeyboard: boolean;
  /** Some note is off the on-screen keyboard's default preset (C2 to B5). */
  outsidePreset: boolean;
}

export interface Refused {
  ok: false;
  message: string;
}

export type UploadCheck = Accepted | Refused;

const refuse = (message: string): Refused => ({ ok: false, message });

/**
 * Checks an uploaded file in the order the step 30 brief sets. Stops at the first failure.
 * The content decides the format, not the extension.
 */
export function checkUpload(
  bytes: Uint8Array,
  fileName: string,
  context: UploadContext,
): UploadCheck {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return refuse('Compressed .mxl is not supported yet. Export uncompressed MusicXML.');
  }
  if (bytes.length > MAX_FILE_BYTES) return refuse('This file is larger than 1 MB.');
  if (context.storedBytes + bytes.length > MAX_TOTAL_BYTES) return refuse(STORAGE_FULL);

  const xml = new TextDecoder().decode(bytes);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror'))
    return refuse('This file is not readable MusicXML.');

  let score: Score;
  try {
    score = parseScore(xml);
  } catch {
    return refuse('This file is not readable MusicXML.');
  }
  if (score.events.length === 0) return refuse('This file has no notes.');

  const title =
    (doc.querySelector('work > work-title')?.textContent ?? '').trim() ||
    fileName.replace(/\.[^.]*$/, '').trim();
  if (title === '') return refuse('This file needs a title.');
  const key = title.toLowerCase();
  if (context.bundledTitles.some((t) => t.trim().toLowerCase() === key)) {
    return refuse('A piece with this name is already built in.');
  }
  if (context.storedTitles.some((t) => t.trim().toLowerCase() === key)) {
    return refuse(
      'A piece with this name is already uploaded; give the file a different title.',
    );
  }

  const notation = notationProblem(doc);
  if (notation) return refuse(notation);

  const unfingered = score.events.find((event) =>
    event.notes.some((note) => !isFingered(note.finger)),
  );
  if (unfingered) {
    return refuse(`Measure ${unfingered.measure} has a note with no finger (1 to 5).`);
  }

  const pitches = score.events.flatMap((event) => event.notes.map((note) => note.pitch));
  return {
    ok: true,
    xml,
    title,
    score,
    waitOnly: !timedPlayable(score),
    outsideKeyboard: pitches.some(
      (p) => p < COMPUTER_KEYBOARD_LOW || p > COMPUTER_KEYBOARD_HIGH,
    ),
    outsidePreset: pitches.some((p) => p < DEFAULT_PRESET_LOW || p > DEFAULT_PRESET_HIGH),
  };
}

/** The first notation the app does not follow, named by its bar, or undefined when there is none. */
function notationProblem(doc: Document): string | undefined {
  if (doc.querySelectorAll('score-partwise > part').length > 1) {
    return 'This file has two parts. Only one part is supported.';
  }
  const onStaffTwo = Array.from(doc.querySelectorAll('note')).some(
    (note) => note.querySelector('staff')?.textContent === '2',
  );
  if (!onStaffTwo)
    return 'This file has one staff. Both hands are needed, on staff 1 and staff 2.';

  const repeat = doc.querySelector('repeat');
  if (repeat) return `Measure ${barOf(repeat)} has a repeat. Write it out in full.`;

  const jump = doc.querySelector(
    'sound[dacapo], sound[dalsegno], sound[fine], sound[tocoda], segno, coda',
  );
  if (jump) return `Measure ${barOf(jump)} has a jump or a coda. Write it out in full.`;

  const measures = Array.from(doc.querySelectorAll('measure'));
  const firstDivisions = numberOf(measures[0], 'divisions') ?? 1;
  for (const measure of measures.slice(1)) {
    for (const attributes of measure.querySelectorAll(':scope > attributes')) {
      if (attributes.querySelector('key')) {
        return `Measure ${barOf(measure)} sets the key again. The key is set once, at the start.`;
      }
      if (
        numberOf(attributes, 'divisions') !== undefined &&
        numberOf(attributes, 'divisions') !== firstDivisions
      ) {
        return `Measure ${barOf(measure)} changes the divisions. They are set once, at the start.`;
      }
    }
  }

  return fillProblem(measures);
}

/**
 * Every measure, on each staff that has content, must reach exactly its time signature. The
 * furthest point is taken, so a backup or forward does not hide a short or overlong bar.
 */
function fillProblem(measures: Element[]): string | undefined {
  let divisions = 1;
  let beats = 4;
  let beatType = 4;

  for (const measure of measures) {
    let cursor = 0;
    let lastStart = 0;
    const furthest = new Map<number, number>();

    for (const child of Array.from(measure.children)) {
      if (child.tagName === 'attributes') {
        divisions = numberOf(child, 'divisions') ?? divisions;
        const time = child.querySelector('time');
        if (time) {
          beats = numberOf(time, 'beats') ?? beats;
          beatType = numberOf(time, 'beat-type') ?? beatType;
        }
      } else if (child.tagName === 'backup') {
        cursor -= numberOf(child, 'duration') ?? 0;
      } else if (child.tagName === 'forward') {
        cursor += numberOf(child, 'duration') ?? 0;
      } else if (child.tagName === 'note' && !child.querySelector('grace')) {
        const duration = numberOf(child, 'duration') ?? 0;
        const isChord = child.querySelector('chord') !== null;
        const start = isChord ? lastStart : cursor;
        if (!isChord) {
          lastStart = cursor;
          cursor += duration;
        }
        const staff = numberOf(child, 'staff') ?? 1;
        furthest.set(staff, Math.max(furthest.get(staff) ?? 0, start + duration));
      }
    }

    const length = (divisions * 4 * beats) / beatType;
    for (const reached of furthest.values()) {
      if (reached < length) {
        return `Measure ${barOf(measure)} is short for its time signature. A pickup must be written out in full.`;
      }
      if (reached > length) {
        return `Measure ${barOf(measure)} is longer than its time signature.`;
      }
    }
  }
  return undefined;
}

function barOf(el: Element): string {
  return el.closest('measure')?.getAttribute('number') ?? '?';
}

function numberOf(el: Element, selector: string): number | undefined {
  const text = el.querySelector(selector)?.textContent;
  return text ? Number(text) : undefined;
}
