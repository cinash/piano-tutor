# Step 5 — Loop selection

Status: **not started**. Depends on step 4. One branch, `step-5-loop-selection`, off `main`.

## Scope change from the original milestone brief

The original plan for this step was "loop and tempo." The user explicitly descoped the tempo
slider for this milestone during step 1 planning: no tempo control, and (per `step4.md`)
no clock-driven animation for the falling-note view either. This step is **loop selection only**.
If tempo comes back in a future milestone, it's a separate piece of work, not a resumption of
this step.

## Goal

Bar-range loop selection: pick a start and end measure, and have the practice engine wrap back
to the start of the range once it reaches the end, instead of continuing to the end of the piece
or stopping.

## In scope

- UI to pick a start/end measure (reuse `EngineState.loop` from step 3, which already carries
  `{ startMeasure, endMeasure }`).
- Engine behavior: once `advance()` would move past `endMeasure`, wrap `nextEventIndex` back to
  the first `ScoreEvent` at or after `startMeasure`, rather than proceeding linearly.
- Held notes and `satisfiedNoteIds` reset cleanly across the wraparound — treat it like starting
  a fresh wait at the loop's first event, not a special case bolted onto `advance()`.

## Gate

Layer 2 tests for the wraparound logic itself (pure, in the engine — no UI needed to test the
state transition). Layer 3 Playwright tests covering loop wraparound in the actual rendered view,
with a screenshot at the loop boundary (per `step4.md`'s screenshot list).

## Manual

Add to `MANUAL-CHECKS.md`: select a short loop range on the real piano, play through it several
times, and confirm it wraps back correctly without losing wait-mode's "no timeout" behavior at
the wrap point.
