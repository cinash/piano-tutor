# Step 4 — Falling-note view

Status: **not started**. Depends on steps 2 and 3. One branch, `step-4-falling-note-view`, off
`main`.

## Goal

Wire the practice engine to the UI: render the upcoming note(s) as blocks with finger numbers,
five fingers colour-coded consistently (colour is the primary cue, the numeral secondary), and
wire wait-mode's hold-and-advance behavior into the display.

## Confirmed decision — no clock-driven animation

Tempo is out of scope for this milestone (see `step5.md`), and wait-mode has no time
limit, so **this view does not animate on a clock**: no `requestAnimationFrame`, no continuous
scroll, no fixed fall speed. Show the current/next expected note(s) (a small queue is fine) and
shift the display forward only when the engine's `advance()` actually advances. This is a pure
re-render on state change, nothing more. A future milestone can revisit continuous motion once
tempo is back in scope — don't build toward it now.

## In scope

- Render `ScoreEvent`s ahead of the current position as blocks, each showing its finger number(s)
  from the `Note.finger` field (blank when absent, per step 2's parser — don't compute a
  fingering that wasn't authored).
- Five-finger colour coding, consistent across the whole view.
- Wire the on-screen keyboard (step 1) and the falling-note queue to the same `EngineState`,
  driven by whichever `MidiSource` is active.
- Expose engine state on `window.__practiceState` as JSON in dev builds, so Playwright can assert
  on it directly instead of scraping the DOM.

## Gate

Layer 3 Playwright tests, with screenshots committed at a few fixed points: start, mid-piece,
waiting-for-wrong-note, and (once step 5 lands) a loop boundary. Keep the timing margins in any
fixture-driven test generous — step 1's flake (see its merge commit) was a real lesson: tight
windows raced against occasional browser stalls under test load, not against the app's logic.

## Manual

Add to `MANUAL-CHECKS.md`: play the piece through on the real piano and confirm the falling-note
view and wait-mode behavior feel right — in particular, that a wrong note visibly does not
advance, and that waiting has no timeout.
