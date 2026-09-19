# Step 2 — Score parsing

Was not to begin until step 1's manual checks and this prompt itself were confirmed. One
branch, `step-2-score-parsing`, off `main`.

## Goal

Turn `cicha-noc.musicxml` into the internal score model below. Pure parsing only — **no UI, no
rendering, no display of any kind**, not even a placeholder. This step produces data and tests
against that data; the falling-note view that eventually shows it is step 4. In particular, do
not build standard notation rendering (e.g. OpenSheetMusicDisplay) — that stays out of scope for
the whole milestone, not just this step.

## Target model

```ts
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
  beat: number; // position within the bar, derived from divisions + time signature
  startTime: number; // in beats from piece start, for tempo-independent layout
  durationBeats: number; // sounding duration, ties already resolved into one event
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
  measureCount: number;
}
```

Design notes, already settled:

- **Rests produce no `ScoreEvent`** — nothing to wait for — but surrounding events' `measure`/
  `beat` are computed from the full timeline including rests, so bar-range looping (step 5)
  stays correct.
- **Ties are resolved during parsing** into a single `ScoreEvent` with combined `durationBeats`;
  the tied-to note never appears as its own event. The engine (step 3) never sees ties.
  `cicha-noc.musicxml` has two of these (mm. 9→10 and 11→12) — use them as the primary test case.
- **Chords are one `ScoreEvent`** with multiple `Note`s, including chords that span both hands
  (e.g. m. 1 beat 1, where the RH melody note and the LH two-note chord all start together —
  confirm your parser treats simultaneous cross-staff notes as one event, not two).
- **Repeats are unrolled at parse time** into the flattened `events` list; the engine never sees
  repeat structure. `cicha-noc.musicxml` doesn't currently exercise this — if you add repeat
  markings, decide measure-numbering-after-unroll and record it in `DECISIONS.md`.
- The piece is in 6/8. Do not build the parser around an assumption of simple meter — derive
  beat and bar positions from the time signature and `<divisions>`, and cover dotted durations
  explicitly.
- `cicha-noc.musicxml` has one note with no `<fingering>` (m. 6, the D4) deliberately contrasted
  with the same note two bars later that does have one (m. 8) — use both as test cases.
- `cicha-noc.musicxml` has **no grace notes**. The spec still requires grace-note handling to be
  covered, so add a small synthetic MusicXML fixture (a handful of measures, not the whole piece)
  containing one, purely for this test.

## Gate

Layer 1 Vitest tests covering: chords, rests, ties (including across a barline), repeats (if you
add any), grace notes (via the synthetic fixture), dotted durations, and a note with no
`<fingering>`. Plus a committed snapshot of the parsed `cicha-noc.musicxml` (e.g. a `.json` file
checked in next to the test) for me to review directly without running anything. `npm run ci`
green with the new tests included.

## Manual

None — this step has no UI. `MANUAL-CHECKS.md` is unchanged.
