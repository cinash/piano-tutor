# Step 10 — Show which keys to play

Depends on steps 3, 4 and 9. One branch, `step-10-keys-to-play`, off `main`.

## Goal

Make the app usable without a score open beside it. Today the queue shows a finger number per
note and nothing anywhere says _which key that finger goes on_, so a player who does not already
know the piece cannot begin. This is the step that turns the app from a display into a tutor;
everything after it is refinement.

## Confirmed decision — a second cue, not a replacement

The keyboard answers _which key_; the queue keeps answering _which finger, and what is coming_,
in the finger colours step 4 chose. This step does not edit `FallingNotes.tsx` and does not
reopen step 4's "colour is the primary cue, the numeral secondary" decision.

## In scope

- One definition of an event's notes, exported from `src/practice/practiceView.ts`:

  ```ts
  export const notesAt = (score: Score, index: number): readonly Note[] =>
    score.events[index]?.notes ?? [];
  ```

  No `status === 'complete'` guard is needed anywhere it is used: `advance()` sets that status
  only on the branch where `score.events[nextEventIndex]` is undefined, so `?? []` already
  covers it.

  Keyed on the index rather than on the whole state, because `advancePracticeView` computes
  this expression twice — once for the current event and once for the one after, for its
  wrong-note check — and the pair is symmetric. `notesAt(score, i)` and `notesAt(score, i + 1)`
  replace both; a helper taking the state could only replace the first and would leave the
  adjacent line inline. Three callers the day it lands, two duplicates removed.

- `PianoKeyboard` gains `expectedNotes: readonly Note[]` beside `heldNotes`, and `App.tsx`
  passes `notesAt(cichaNocScore, view.engine.nextEventIndex)` straight through — the prop name
  carries the intent, so the helper does not have to. Each key looks its own note up:

  ```tsx
  const expected = expectedNotes.find((note) => note.pitch === key.note);
  // renders data-expected={Boolean(expected)}
  ```

  **Pass the notes, not a set of pitches.** A `Set<number>` would have to be rebuilt as a
  `Map<number, Hand>` in step 11 to carry the hand — rewriting the prop, its tests and the
  App-side construction one step later. `Note` already carries `hand`, so step 11 adds one
  attribute and nothing else. A `find` over the two or three notes of a chord is not a cost
  worth a collection.

  `heldNotes` stays a `ReadonlySet<number>`: it comes from MIDI and has no `Note` behind it.

- `data-expected` sits next to the existing `data-held` — that attribute pattern is already the
  component's idiom, and it gives Layer 3 a handle without growing `window.__practiceState`,
  which `DECISIONS.md` asks to keep to what a test actually needs.
- `.piano-key--expected` in white and black variants, in the existing palette's idiom.
- **State precedence, decided here rather than left to CSS file order:** a key that is both
  expected and held renders as held — you are playing it, which is the more specific fact, and
  it agrees with the queue circle that dims when a note is satisfied. Two classes at equal
  specificity resolving by source order is a coincidence, not a decision; write it so it cannot
  be reordered by accident.

## Out of scope

- Hand colours (step 11), note names (step 13), hand filtering (step 14).
- Colouring a _wrong_ held note on the keyboard. Wrongness already shows on the queue's current
  box; a third keyboard state, before the second has been watched in real practice, is
  speculative.
- Animating the highlight as it moves between events. Step 4's no-clock decision still holds.

## Decisions to record in `DECISIONS.md`

- Keyboard = which key, queue = which finger; deliberately two cues.
- Expected-and-held renders as held, for the reason above.

## Gate

- Layer 2: `notesAt()` returns an event's notes, and an empty list for an index past the end —
  which is the completed state too, not a second case. Component
  test over `PianoKeyboard` for a key that is expected, one held, one both, one neither,
  asserting the `data-` attributes rather than the classes, as `PianoKeyboard.test.tsx` already
  does for `data-held`.
- Layer 3: connect the virtual keyboard, then assert that exactly the opening chord's three
  pitches carry `data-expected="true"` and nothing else does. Play the lowest of them; assert it
  is now held and still expected. Complete the chord; assert the expected set has moved on to
  the next event's single pitch. This is the check that establishes the requested behaviour
  exists — a green suite without it proves only that nothing else broke.
- No committed screenshot; step 13 takes the one keyboard snapshot.

## Manual

Fold into `MANUAL-CHECKS.md` item 3 as revised by step 9, rather than appending an eleventh:
with nothing held, confirm the keys the app is waiting for are visibly marked, and that playing
one of them leaves it marked until the whole chord is played.
