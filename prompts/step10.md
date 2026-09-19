# Step 10 — Show which keys to play

Depends on steps 3, 4 and 9. One branch, `step-10-keys-to-play`, off `main`.

## Goal

Make the app usable without a score open beside it. Today the queue shows a finger number per
note and nothing anywhere says _which key that finger goes on_, so a player who does not
already know the piece cannot begin. This is the step that turns the app from a display into a
tutor; everything after it is refinement.

## Confirmed decision — a second cue, not a replacement

The keyboard answers _which key_; the queue keeps answering _which finger, and what is coming_,
in the finger colours step 4 chose. This step does not edit `FallingNotes.tsx` and does not
reopen step 4's "colour is the primary cue, the numeral secondary" decision.

## In scope

- One definition of what the engine is waiting for, exported from
  `src/practice/practiceView.ts`:

  ```ts
  export function expectedNotes(state: PracticeViewState, score: Score): readonly Note[] {
    if (state.engine.status === 'complete') return [];
    return score.events[state.engine.nextEventIndex]?.notes ?? [];
  }
  ```

  It has two callers the day it lands, not one: `advancePracticeView` in the same file already
  computes `score.events[state.engine.nextEventIndex]?.notes ?? []` inline for its wrong-note
  check, inside a branch that has already established `status === 'waiting'`, so the helper is
  equivalent there and replaces it. Step 14 later filters it for one-hand practice. Do not
  justify it by a list of future consumers; the duplicate it removes is present now.

- `PianoKeyboard` gains `expectedNotes: ReadonlySet<number>` beside `heldNotes`, and renders
  `data-expected` next to the existing `data-held`. That attribute pattern is already the
  component's idiom and gives Layer 3 a handle without growing `window.__practiceState`,
  which `DECISIONS.md` asks to keep to what a test actually needs. Step 11 widens this prop to
  a map carrying the hand, so it and its tests get rewritten one step later; a set is what this
  step needs, and guessing at step 11's shape now would be building for a requirement that has
  not arrived.
- `.piano-key--expected` in white and black variants, in the existing palette's idiom.
- **State precedence, decided here rather than left to CSS file order:** a key that is both
  expected and held renders as held — you are playing it, which is the more specific fact, and
  it agrees with the queue circle that dims when a note is satisfied. Two classes at equal
  specificity resolving by source order is a coincidence, not a decision; write it so it
  cannot be reordered by accident.
- `App.tsx` computes the set once per render and passes it down.

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

- Layer 2: `expectedNotes()` returns the current event's notes while waiting, an empty list
  when `status` is `complete`, and an empty list for an index past the end. Component test over
  `PianoKeyboard` for a key that is expected, one held, one both, one neither — asserting the
  classes and the `data-` attributes.
- Layer 3: connect the virtual keyboard, then assert that exactly the opening chord's three
  pitches carry `data-expected="true"` and nothing else does. Play the lowest of them; assert
  it is now held and still expected. Complete the chord; assert the expected set has moved on
  to the next event's single pitch. This
  is the check that establishes the requested behaviour exists — a green suite without it
  proves only that nothing else broke.
- The first committed screenshot of the `piano-keyboard` element, at the start position. Step 9
  settled the width first so this is taken once.

## Manual

Fold into `MANUAL-CHECKS.md` item 3 as revised by step 9, rather than appending an eleventh:
with nothing held, confirm the keys the app is waiting for are visibly marked, and that playing
one of them leaves it marked until the whole chord is played.
