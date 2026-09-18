# Step 6 — Restart, and what an attempt contains

Status: **not started**. Depends on step 5. One branch, `step-6-restart-and-attempt-stats`,
off `main`.

## Goal

Start the piece again without disturbing anything around it, and count what each run through
contains. One idea stated twice: an _attempt_ is what happens between one restart and the
next, and these are the numbers that describe it. Step 7 writes them down; this step produces
them.

## The summary being counted

```ts
interface AttemptStats {
  notesPlayed: number;
  wrongNoteCount: number;
}
```

That is the whole model, and it is deliberately clock-free: `advancePracticeView` is a pure
reducer whose only time input is the source-relative `MidiEvent.time` (see `DECISIONS.md`),
which is meaningless as a date. When an attempt _happened_ is therefore not this step's to
record — step 7 stamps it where the wall clock actually lives.

Accuracy is `1 - wrongNoteCount / notesPlayed`, derived where it is displayed rather than
stored; a stored ratio is a second copy of the same fact that can disagree with its inputs.

## In scope

- `restartPractice(state)` in `src/practice/practiceView.ts`: a fresh view state carrying the
  existing `loop` across. Both halves already exist, so this composes them rather than
  reimplementing either.
- A Restart button in `App.tsx`, rendered whenever a source is connected (`active.kind !==
'none'`), with a `data-testid`. It works from a finished piece too, so `status: 'complete'`
  stops being a dead end.
- `attempt: AttemptStats` on `PracticeViewState`, updated in `advancePracticeView` alongside
  `wrongNotes`, reusing the wrong-note decision already made there rather than re-deriving it.
  Both counters sit behind that function's existing `status === 'waiting'` guard, so playing
  on past the end of the piece doesn't inflate `notesPlayed` against a `wrongNoteCount` that
  has stopped moving.
- Both counters added to the `window.__practiceState` snapshot and to `e2e/window.d.ts`, which
  is how Layer 3 asserts on them. They live on `PracticeViewState`, not `EngineState`, so
  `toPracticeStateSnapshot` takes the view state instead — a signature change and one call
  site.

## Out of scope

- Persistence and any history UI — step 7.
- A visible live readout of the counters. The user asked for a history list as the way to
  review progress; a permanent on-screen scoreboard is UI nobody asked for, and
  `window.__practiceState` exists precisely so a test can see state the UI doesn't show.
- Per-measure attribution, and any count of score events completed.
- Changing what `attach()` / `disconnect()` do. They already build a fresh view state; leave
  them alone even though restart now overlaps them, and note the overlap in the report rather
  than refactoring the two together.

## Decisions to record in `DECISIONS.md`

Restart preserves the loop range, on the grounds that "play that range again" is the normal
reason to press it — whereas connecting a device is a fresh start and keeps dropping the loop.
Say it explicitly, because the two paths now differ.

The existing `window.__practiceState` entry names the snapshot's two fields and its
`EngineState` parameter literally, so it goes stale the moment this step lands — update it in
the same commit rather than leaving the next reader to discover the drift.

## Gate

- Layer 2: `restartPractice` returns index 0, empty `satisfiedNoteIds` / `wrongNotes` /
  `heldNotes` and zeroed counters, with the same `loop` it was given; counters over a scripted
  event sequence count each wrong note once and ignore notes played after completion.
- Layer 3: with the virtual keyboard, play the opening measure including one wrong note, and
  assert the counters and `nextEventIndex` on `window.__practiceState`; press Restart and
  assert all three are back to zero — `nextEventIndex` included, since returning to the first
  note is the user-visible point of the button — with the loop inputs still holding their
  range.

## Manual

Fold into `MANUAL-CHECKS.md` item 9 rather than appending — the file asks to stay under ten
items: while playing the piece on the real piano, press Restart and confirm it returns to the
first note with the piano still connected and the loop range unchanged.
