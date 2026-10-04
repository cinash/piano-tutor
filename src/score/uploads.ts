import { isFingered } from './pieceRules';
import { numberContent, parseScore } from './parseScore';
import { PIECES, type Piece } from './pieces';
import type { Score } from './types';

export const MAX_FILE_BYTES = 1_000_000;
export const MAX_TOTAL_BYTES = 2_000_000;

const STORAGE_FULL =
  "Browser storage for your pieces is full. To make room, download your progress first, then clear the site's data.";

export interface UploadContext {
  bundledTitles: readonly string[];
  storedTitles: readonly string[];
  /** The UTF-8 bytes of every stored record's XML, summed. */
  storedBytes: number;
}

export function uploadContext(uploads: readonly Piece[]): UploadContext {
  const encoder = new TextEncoder();
  return {
    bundledTitles: PIECES.map((piece) => piece.title),
    storedTitles: uploads.map((upload) => upload.title),
    storedBytes: uploads.reduce(
      (sum, upload) => sum + encoder.encode(upload.xml).length,
      0,
    ),
  };
}

export interface Accepted {
  ok: true;
  xml: string;
  title: string;
  score: Score;
}

interface Refused {
  ok: false;
  message: string;
}

type UploadCheck = Accepted | Refused;

const refuse = (message: string): Refused => ({ ok: false, message });

/**
 * Checks an uploaded file in the order the step 30 brief sets. Stops at the first failure.
 * The content decides the format, not the extension. What it accepts is only what it checked:
 * the wait-only mark and the range warnings are read from the score by pieceRules.ts.
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
  let score: Score;
  try {
    score = parseScore(xml);
  } catch {
    return refuse('This file is not readable MusicXML.');
  }
  if (score.events.length === 0) return refuse('This file has no notes.');

  const title = titleOf(score.title, fileName);
  if (title === '') return refuse('This file needs a title.');
  if (
    clashes(
      context.bundledTitles.map((t) => t.trim()),
      title,
    )
  ) {
    return refuse('A piece with this name is already built in.');
  }
  if (clashes(context.storedTitles, title)) {
    return refuse(
      'A piece with this name is already uploaded; give the file a different title.',
    );
  }

  const notation = notationProblem(xml);
  if (notation) return refuse(notation);

  const unfingered = score.events.find((event) =>
    event.notes.some((note) => !isFingered(note.finger)),
  );
  if (unfingered) {
    return refuse(`Measure ${unfingered.measure} has a note with no finger (1 to 5).`);
  }

  return { ok: true, xml, title, score };
}

/** The `<work-title>`, or the file name without its extension when that is absent or blank. */
function titleOf(workTitle: string, fileName: string): string {
  return workTitle.trim() || fileName.replace(/\.[^.]*$/, '').trim();
}

function clashes(titles: readonly string[], title: string): boolean {
  const key = title.toLowerCase();
  return titles.some((t) => t.toLowerCase() === key);
}

/** The first notation the app does not follow, named by its bar, or undefined when there is none. */
function notationProblem(xml: string): string | undefined {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
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

  const keyChange = doc.querySelector('measure:not(:first-of-type) > attributes > key');
  if (keyChange) {
    return `Measure ${barOf(keyChange)} sets the key again. The key is set once, at the start.`;
  }

  const firstDivisions = numberContent(doc.querySelector('measure')!, 'divisions') ?? 1;
  const divisionsChange = Array.from(
    doc.querySelectorAll('measure:not(:first-of-type) > attributes'),
  ).find(
    (attributes) =>
      (numberContent(attributes, 'divisions') ?? firstDivisions) !== firstDivisions,
  );
  if (divisionsChange) {
    return `Measure ${barOf(divisionsChange)} changes the divisions. They are set once, at the start.`;
  }

  return fillProblem(Array.from(doc.querySelectorAll('measure')));
}

/**
 * Every measure, on each staff that has content, must reach exactly its time signature. The
 * furthest point is taken: a note, a rest, or the end of a forward, so a backup does not hide a
 * short or overlong bar, and a forward that leaves a gap at the end of a staff still counts.
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
        divisions = numberContent(child, 'divisions') ?? divisions;
        const time = child.querySelector('time');
        if (time) {
          beats = numberContent(time, 'beats') ?? beats;
          beatType = numberContent(time, 'beat-type') ?? beatType;
        }
      } else if (child.tagName === 'backup') {
        cursor -= numberContent(child, 'duration') ?? 0;
      } else if (child.tagName === 'forward') {
        cursor += numberContent(child, 'duration') ?? 0;
        const staff = numberContent(child, 'staff') ?? 1;
        furthest.set(staff, Math.max(furthest.get(staff) ?? 0, cursor));
      } else if (child.tagName === 'note' && !child.querySelector('grace')) {
        const duration = numberContent(child, 'duration') ?? 0;
        const isChord = child.querySelector('chord') !== null;
        const start = isChord ? lastStart : cursor;
        if (!isChord) {
          lastStart = cursor;
          cursor += duration;
        }
        const staff = numberContent(child, 'staff') ?? 1;
        furthest.set(staff, Math.max(furthest.get(staff) ?? 0, start + duration));
      }
    }

    const length = (divisions * 4 * beats) / beatType;
    for (const reached of furthest.values()) {
      if (reached < length) {
        return `Measure ${barOf(measure)} is short for its time signature: a pickup, or a rest missing.`;
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

const STORAGE_KEY = 'piano-tutor.uploaded-pieces.v1';

/** What storage keeps of an upload: the raw XML, so a later parser re-reads it. */
interface UploadRecord {
  /** `upload-` and a slug of the title, made once at upload, so a title keeps its id. */
  id: string;
  title: string;
  xml: string;
}

/**
 * Reads the stored uploads, dropping any record that no longer parses into a piece with a
 * note, and writes the list back without it, so storage matches what is offered. Checks 1
 * to 6 are not run again: a rule added later never removes a file the upload accepted.
 */
export function loadUploads(): readonly Piece[] {
  const stored = readStored();
  const kept = stored.flatMap(({ id, title, xml }) => {
    const score = scoreOf(xml);
    if (score) return [{ id, title, xml, score }];
    console.warn(`Dropping the uploaded piece "${title}": it no longer loads.`);
    return [];
  });
  if (kept.length < stored.length) saveUploads(kept);
  return kept;
}

/**
 * The stored records: none when nothing is stored, and none, with a warning, for a value
 * that is not a list of them.
 */
function readStored(): UploadRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    stored = undefined;
  }
  if (Array.isArray(stored) && stored.every(isUploadRecord)) return stored;
  console.warn(`Ignoring ${STORAGE_KEY}: it is not a list of uploaded pieces.`);
  return [];
}

function isUploadRecord(value: unknown): value is UploadRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'xml' in value &&
    typeof value.xml === 'string'
  );
}

/** What playing needs of a stored file: it parses, and it has a note. */
function scoreOf(xml: string): Score | undefined {
  try {
    const score = parseScore(xml);
    return score.events.length > 0 ? score : undefined;
  } catch {
    return undefined;
  }
}

/** Stores the list. Throws, storing nothing new, when storage is full. */
export function saveUploads(uploads: readonly Piece[]): void {
  const records: UploadRecord[] = uploads.map(({ id, title, xml }) => ({
    id,
    title,
    xml,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** The new upload for a checked file, its id unique among `uploads`. */
export function newUpload(
  { title, xml, score }: Accepted,
  uploads: readonly Piece[],
): Piece {
  const base = `upload-${slug(title)}`;
  let id = base;
  for (let n = 2; uploads.some((upload) => upload.id === id); n++) id = `${base}-${n}`;
  return { id, title, xml, score };
}

/** ASCII only: accents dropped, ł read as l, and a title with no Latin letters as `piece`. */
function slug(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[łŁ]/g, 'l')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'piece'
  );
}
