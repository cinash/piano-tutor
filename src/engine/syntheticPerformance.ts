import type { Score } from '../score/types';
import type { MidiEvent } from '../midi/types';

/**
 * Milliseconds per quarter-note beat used only to space out the notes this module
 * generates. Tempo is out of scope for the milestone (see DECISIONS.md); this
 * constant exists purely so synthetic fixtures have realistic, orderable timestamps.
 */
export const MS_PER_BEAT = 500;

const byTime = (a: MidiEvent, b: MidiEvent) => a.time - b.time;

/** A "perfect" MidiEvent stream that plays every ScoreEvent exactly as written. */
export function generatePerfectPerformance(score: Score): MidiEvent[] {
  const events: MidiEvent[] = [];
  for (const scoreEvent of score.events) {
    const onset = scoreEvent.startTime * MS_PER_BEAT;
    const release = onset + scoreEvent.durationBeats * MS_PER_BEAT;
    for (const note of scoreEvent.notes) {
      events.push({ type: 'noteOn', note: note.pitch, velocity: 100, time: onset });
    }
    for (const note of scoreEvent.notes) {
      events.push({ type: 'noteOff', note: note.pitch, time: release });
    }
  }
  return events;
}

/** Replaces every occurrence of a pitch (both its note-on and note-off) with another. */
export function replacePitch(
  events: MidiEvent[],
  pitch: number,
  replacement: number,
): MidiEvent[] {
  return events.map((event) =>
    event.note === pitch ? { ...event, note: replacement } : event,
  );
}

/** Shifts a pitch's first matching event by `deltaMs` (negative shifts it earlier). */
function shiftFirst(
  events: MidiEvent[],
  type: MidiEvent['type'],
  pitch: number,
  deltaMs: number,
): MidiEvent[] {
  const target = events.findIndex((event) => event.type === type && event.note === pitch);
  return events
    .map((event, index) =>
      index === target ? { ...event, time: event.time + deltaMs } : event,
    )
    .sort(byTime);
}

export function shiftNoteOn(
  events: MidiEvent[],
  pitch: number,
  deltaMs: number,
): MidiEvent[] {
  return shiftFirst(events, 'noteOn', pitch, deltaMs);
}

export function shiftNoteOff(
  events: MidiEvent[],
  pitch: number,
  deltaMs: number,
): MidiEvent[] {
  return shiftFirst(events, 'noteOff', pitch, deltaMs);
}

/** Inserts an unexpected note-on/note-off pair at the given time. */
export function insertNote(
  events: MidiEvent[],
  pitch: number,
  onsetMs: number,
  durationMs: number,
): MidiEvent[] {
  const withNote: MidiEvent[] = [
    ...events,
    { type: 'noteOn', note: pitch, velocity: 100, time: onsetMs },
    { type: 'noteOff', note: pitch, time: onsetMs + durationMs },
  ];
  return withNote.sort(byTime);
}

/** Removes every event for a pitch, as if it was never played. */
export function dropNote(events: MidiEvent[], pitch: number): MidiEvent[] {
  return events.filter((event) => event.note !== pitch);
}

/** Removes just a pitch's first note-on, leaving its note-off dangling. */
export function dropNoteOn(events: MidiEvent[], pitch: number): MidiEvent[] {
  let dropped = false;
  return events.filter((event) => {
    if (!dropped && event.type === 'noteOn' && event.note === pitch) {
      dropped = true;
      return false;
    }
    return true;
  });
}
