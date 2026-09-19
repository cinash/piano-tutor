# Step 12 — Where you are in the piece

Depends on step 3. One branch, `step-12-position-readout`, off `main`.

## Goal

Nothing on screen says where in Cicha Noc you are. The queue shows four events and the history
shows finished attempts; between them there is no answer to "am I near the end". One line of
text fixes it.

## Confirmed decision — a line of text, not a progress bar

A bar implies proportion, and the honest proportion is over events rather than time, which is
not what it would look like it meant. Text states exactly what is known: the measure, the
total, and the loop when one is set.

## In scope

- A pure formatter, unit-testable without a DOM, with two branches: `Measure 3 of 12` while
  playing, `Complete` when `status` is `complete`. No loop suffix — `LoopPicker` already shows
  the range on screen, and repeating it here buys a third branch and two more test cases to
  restate what is two inches away.
- Rendered near the queue, with a `data-testid` for Layer 3. **Not inside the `falling-notes`
  element**: four committed screenshots in `e2e/falling-notes.spec.ts` are scoped to it, and
  putting a line of live text in there invalidates all four — loudly, but for no reason.

## Watch out for `nextEventIndex` pointing past the end

`nextEventIndex` can point past the end of `score.events` once `status` is `complete`, so
`score.events[nextEventIndex].measure` throws on the last note of every successful
run-through. Branch on the status rather than indexing, and cover completion at Layer 2 — a
Layer 3 version means playing all 41 events, which is the call `step7.md` made about
`reachedEnd` for the same reason.

## Out of scope

- Percentage complete, elapsed time, estimated time remaining — all of them tempo-shaped, and
  tempo is out of scope by `step5.md`.
- Beat-level position within the measure.
- Any change to `LoopPicker`.

## Decisions to record in `DECISIONS.md`

Only if the completion trap above is not already covered by an existing entry: a one-line note
that `nextEventIndex` is deliberately allowed past the end and `status` is the guard.

## Gate

- Layer 2: the formatter over a mid-piece state, a completed state, and the initial state.
- Layer 3: assert it reads `Measure 1 of 12` at the start and changes after the opening measure
  is played.
- No screenshot. A line of text's correctness is fully expressible as an assertion, which is
  the same reasoning `step7.md` used for the history table.

## Manual

No new item and no revision. This is checked by looking at it, and the existing play-through
item already has the player watching this area of the screen.
