export type Hand = 'left' | 'right';
export type Finger = 1 | 2 | 3 | 4 | 5;

export interface Note {
  pitch: number; // MIDI note number
  hand: Hand;
  finger?: Finger; // absent when the MusicXML has no <fingering>
}

// One simultaneous attack point: one note, or a chord, possibly spanning both hands.
export interface ScoreEvent {
  id: string; // stable id, e.g. "m3-b2-e1", for engine/UI/test cross-reference
  notes: Note[]; // length 1 for a single note, >1 for a chord
  measure: number; // 1-based
  beat: number; // position within the bar, in pulses of the prevailing time signature's beat unit (e.g. eighths in 6/8)
  startTime: number; // in quarter-note beats from piece start, independent of time signature, for tempo-independent layout
  durationBeats: number; // sounding duration in quarter-note beats, ties already resolved into one event
}

export interface TimeSignature {
  beats: number; // numerator, e.g. 6
  beatType: number; // denominator, e.g. 8
  measure: number; // first measure this signature applies from
}

export interface Score {
  title: string;
  divisions: number; // ppq from the MusicXML, kept for reference/debugging
  timeSignatures: TimeSignature[];
  events: ScoreEvent[]; // flattened, in performance order, rests omitted
  fifths: number; // key signature: sharps if positive, flats if negative; 0 when the score has no <key>
  measureCount: number;
}
