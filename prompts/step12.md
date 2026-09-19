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

- A pure formatter, unit-testable without a DOM, producing:
  - `Measure 3 of 12` while playing;
  - `Measure 2 of 12 · looping 1–2` when a loop is set — the loop range is already on screen in
    `LoopPicker`, but the current measure is what gives it context;
  - `Complete` when `status` is `complete`.
- Rendered near the queue, with a `data-testid` for Layer 3.

## Watch out for `nextEventIndex` pointing past the end

This is the trap in this step. When the final chord is satisfied, `completeCurrentEvent` sets
`nextEventIndex` to an index with **no event behind it** and `status` to `complete`:

```ts
const nextEventIndex = nextIndexAfter(state, score);
const nextEvent = score.events[nextEventIndex];
if (!nextEvent) {
  return { ...state, nextEventIndex, status: 'complete', ... };
}
```

So `score.events[state.engine.nextEventIndex].measure` throws on the last note of every
successful run-through — the one path a happy-path test is least likely to reach, because
reaching it means playing all 41 events. Check `status` first, and cover the completion case at
Layer 2 where it is one line of setup rather than a long Layer 3 performance. `step7.md` made
the same call about `reachedEnd` for the same reason.

## Out of scope

- Percentage complete, elapsed time, estimated time remaining — all of them tempo-shaped, and
  tempo is out of scope by `step5.md`.
- Beat-level position within the measure.
- Any change to `LoopPicker`.

## Decisions to record in `DECISIONS.md`

Only if the completion trap above is not already covered by an existing entry: a one-line note
that `nextEventIndex` is deliberately allowed past the end and `status` is the guard.

## Gate

- Layer 2: the formatter over a mid-piece state, a looping state, a completed state, and the
  initial state.
- Layer 3: assert it reads `Measure 1 of 12` at the start and changes after the opening measure
  is played.
- No screenshot. A line of text's correctness is fully expressible as an assertion, which is
  the same reasoning `step7.md` used for the history table.

## Manual

No new item and no revision. This is checked by looking at it, and the existing play-through
item already has the player watching this area of the screen.
