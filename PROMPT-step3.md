# Step 3 — Practice engine

Status: **not started**. Depends on step 2's `Score` model. One branch, `step-3-practice-engine`,
off `main`.

## Goal

The wait-mode state machine, pure, no UI, no DOM, no timers. It takes a `MidiEvent` and a clock
reading and returns new state.

```ts
export interface EngineState {
  status: 'waiting' | 'complete';
  nextEventIndex: number; // index into Score.events
  satisfiedNoteIds: Set<number>; // which pitches of the current chord have sounded
  heldNotes: Set<number>; // currently-down pitches, for keyboard rendering
  loop?: { startMeasure: number; endMeasure: number }; // wired up properly in step 5
}

export function advance(
  state: EngineState,
  score: Score,
  event: MidiEvent,
  clock: number,
): EngineState;
```

`advance` is the entire engine surface.

## Confirmed semantics

- **Chords**: each expected pitch in the current `ScoreEvent` must eventually sound within the
  roll window; a simultaneous _extra_ pitch alongside a correct one is ignored (per the
  extra-note case below), but a wrong note played instead of an expected one — with no correct
  note replacing it — does not advance.
- **`noteOff` never blocks or gates advancement.** It only affects `heldNotes` (display).
- No time limit on waiting, ever.
- All timing tolerances (chord-roll window, early-note grace, note-off debounce) live in one
  exported config object with documented defaults, so they can be tuned from one place after
  watching real practice sessions.

## Layer 2: synthetic performances

Write a generator that produces, from a parsed `Score`, a "perfect" `MidiEvent[]` stream. Then
write mutators that derive imperfect streams from it. Treat this list as the specification of
correct behavior, and add a case whenever a real bug (found via the recording-mode workflow)
reveals one that isn't here yet:

1. **Wrong note** — substitute a non-expected pitch for one expected note → does not advance;
   the correct notes already played in the same chord aren't lost.
2. **Note early** — shift a `noteOn` earlier, within the early-note grace → still advances.
3. **Note late** — shift a `noteOn` later, beyond grace → keeps waiting (no timeout), advances
   once it finally arrives.
4. **Extra note** — an unexpected additional `noteOn` interleaved between real notes → ignored,
   no advancement, no corruption.
5. **Missing note (partial chord)** — one note of a chord never sounds → stays waiting
   indefinitely; the notes that did sound stay satisfied so completing only the missing one is
   enough.
6. **Rolled chord** — chord notes spread 20-120ms apart → advances once all sound within the
   configured roll window; test both just-inside and just-outside the boundary.
7. **Note held too long into the next event** — `noteOff` for event N arrives after `noteOn` for
   event N+1 → doesn't block or corrupt advancement of N+1.
8. **Duplicate note-on** — a second `noteOn` for an already-satisfied pitch in the current chord,
   with no intervening `noteOff` → no-op, not counted as an extra note.
9. **Note-off with no matching note-on** — ignored, no crash, no negative/absent-key artifacts in
   `heldNotes`.
10. **Chord notes in arbitrary order** — order within the roll window must not matter, only
    pitch-set membership.
11. **Right-note-wrong-octave** — pitch class matches, absolute pitch doesn't → treated as a
    wrong note (case 1), does not advance. Confirms exact MIDI-number comparison, not
    octave-tolerant matching.
12. **Wrong note released before the correct one is played** — wrong `noteOn` immediately
    followed by its own `noteOff`, then the correct note → advances normally, no residue in
    `heldNotes`.

## Gate

Full Layer 2 suite passing. `npm run ci` green.

## Manual

None — no UI yet. `MANUAL-CHECKS.md` is unchanged.
