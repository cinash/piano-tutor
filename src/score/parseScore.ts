import type { Finger, Hand, Note, Score, ScoreEvent, TimeSignature } from './types';

const SEMITONES_FROM_C: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * A single sounding pitch after tie chains have been merged into one note, but
 * before simultaneous notes are grouped into chords. `startDivisions` and
 * `durationDivisions` are absolute from the start of the piece.
 */
interface TiedNote {
  pitch: number;
  hand: Hand;
  finger?: Finger;
  measure: number;
  beat: number;
  startDivisions: number;
  durationDivisions: number;
}

/** Parses a MusicXML document (as text) into the app's internal Score model. */
export function parseScore(xml: string): Score {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError)
    throw new Error(`Failed to parse MusicXML: ${parserError.textContent}`);

  const part = doc.querySelector('part');
  if (!part) throw new Error('MusicXML has no <part>');

  const title = doc.querySelector('work > work-title')?.textContent ?? '';
  const { notes, divisions, timeSignatures } = readTiedNotes(part);

  return {
    title,
    divisions,
    timeSignatures,
    events: groupIntoEvents(notes, divisions),
    // The first key only: a key change later in the piece is not followed — see DECISIONS.md.
    fifths: Number(part.querySelector('key > fifths')?.textContent ?? 0),
    measureCount: part.querySelectorAll('measure').length,
  };
}

function readTiedNotes(part: Element): {
  notes: TiedNote[];
  divisions: number;
  timeSignatures: TimeSignature[];
} {
  const notes: TiedNote[] = [];
  const openTies = new Map<string, TiedNote>();
  const timeSignatures: TimeSignature[] = [];

  let divisions = 1;
  let beats = 4;
  let beatType = 4;
  let measureStartDivisions = 0;

  for (const measureEl of part.querySelectorAll('measure')) {
    const measureNumber = Number(measureEl.getAttribute('number'));
    let cursor = 0;
    let lastNoteStart = 0;

    for (const child of measureEl.children) {
      if (child.tagName === 'attributes') {
        divisions = numberContent(child, 'divisions') ?? divisions;

        const timeEl = child.querySelector('time');
        if (timeEl) {
          const newBeats = numberContent(timeEl, 'beats') ?? beats;
          const newBeatType = numberContent(timeEl, 'beat-type') ?? beatType;
          if (newBeats !== beats || newBeatType !== beatType) {
            timeSignatures.push({
              beats: newBeats,
              beatType: newBeatType,
              measure: measureNumber,
            });
          }
          beats = newBeats;
          beatType = newBeatType;
        }
      } else if (child.tagName === 'backup') {
        cursor -= numberContent(child, 'duration') ?? 0;
      } else if (child.tagName === 'forward') {
        cursor += numberContent(child, 'duration') ?? 0;
      } else if (child.tagName === 'note') {
        if (child.querySelector('grace')) continue; // no <duration>, doesn't advance the cursor

        const durationDivisions = numberContent(child, 'duration') ?? 0;
        const isChord = child.querySelector('chord') !== null;
        const startDivisions = isChord ? lastNoteStart : cursor;

        if (!isChord) {
          lastNoteStart = cursor;
          cursor += durationDivisions;
        }

        if (child.querySelector('rest')) continue;

        addTiedNote(
          notes,
          openTies,
          {
            pitch: readPitch(child),
            hand: numberContent(child, 'staff') === 2 ? 'left' : 'right',
            finger: readFinger(child),
            measure: measureNumber,
            beat: 1 + startDivisions / divisionsPerBeat(divisions, beatType),
            startDivisions: measureStartDivisions + startDivisions,
            durationDivisions,
          },
          child.querySelector('tie[type="start"]') !== null,
          child.querySelector('tie[type="stop"]') !== null,
        );
      }
    }

    measureStartDivisions += beats * divisionsPerBeat(divisions, beatType);
  }

  return { notes, divisions, timeSignatures };
}

/**
 * Ties connect two <note> elements of the same pitch in the same voice. Rather than
 * track voice explicitly, pitch + hand is a sufficient key: two simultaneous tied
 * chains of the same pitch in the same hand can't exist, since they'd be indistinguishable
 * notes anyway. A tie-stop note is merged into the open note's duration and doesn't
 * become an event of its own; if it's also a tie-start, the chain continues.
 */
function addTiedNote(
  notes: TiedNote[],
  openTies: Map<string, TiedNote>,
  note: TiedNote,
  tieStart: boolean,
  tieStop: boolean,
): void {
  const tieKey = `${note.hand}-${note.pitch}`;
  const open = tieStop ? openTies.get(tieKey) : undefined;

  if (open) {
    open.durationDivisions += note.durationDivisions;
    if (!tieStart) openTies.delete(tieKey);
    return;
  }

  notes.push(note);
  if (tieStart) openTies.set(tieKey, note);
}

function readPitch(noteEl: Element): number {
  // Only called for sounding, pitched notes (rests and grace notes are filtered out
  // earlier), so <pitch>, <step> and <octave> are guaranteed present.
  const pitchEl = noteEl.querySelector('pitch')!;
  const step = pitchEl.querySelector('step')!.textContent!;
  const octave = numberContent(pitchEl, 'octave')!;
  const alter = numberContent(pitchEl, 'alter') ?? 0; // absent unless the note is altered
  return (octave + 1) * 12 + SEMITONES_FROM_C[step] + alter;
}

function readFinger(noteEl: Element): Finger | undefined {
  const text = noteEl.querySelector('technical > fingering')?.textContent;
  return text ? (Number(text) as Finger) : undefined;
}

export function numberContent(el: Element, selector: string): number | undefined {
  const text = el.querySelector(selector)?.textContent;
  return text ? Number(text) : undefined;
}

/** How many divisions make up one pulse of the time signature's own beat unit. */
function divisionsPerBeat(divisions: number, beatType: number): number {
  return (divisions * 4) / beatType;
}

function groupIntoEvents(notes: TiedNote[], divisions: number): ScoreEvent[] {
  const byStart = new Map<number, TiedNote[]>();
  for (const note of notes) {
    const group = byStart.get(note.startDivisions);
    if (group) group.push(note);
    else byStart.set(note.startDivisions, [note]);
  }

  const groups = [...byStart.entries()].sort(([a], [b]) => a - b);

  return groups.map(([startDivisions, group]) => {
    const { measure, beat } = group[0];
    const notesInEvent: Note[] = group.map(({ pitch, hand, finger }) => ({
      pitch,
      hand,
      ...(finger !== undefined ? { finger } : {}),
    }));
    const durationDivisions = Math.max(...group.map((n) => n.durationDivisions));

    return {
      // "-e1": each group has a distinct startDivisions, and MusicXML measure numbers
      // are unique and increasing, so "m{measure}-b{beat}" is already unique on its own.
      id: `m${measure}-b${beat}-e1`,
      notes: notesInEvent,
      measure,
      beat,
      startTime: startDivisions / divisions,
      durationBeats: durationDivisions / divisions,
    };
  });
}
