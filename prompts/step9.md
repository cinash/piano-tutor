# Step 9 — A keyboard the size of a piano

Depends on step 2. One branch, `step-9-keyboard-range`, off `main`.

## Goal

The on-screen keyboard is 20 keys — C3 to G4, under two octaves, ending mid-octave on a G with
no A or B after it. Next to a real 88-key instrument it reads as stunted rather than as a
piano, and it is the first thing on screen a player compares against what is under their hands.
Make it four octaves, and make it start and end where a keyboard does.

## Confirmed decision — one constant, not a derivation

`src/config.ts` has said "hardcoded... until step 2 derives it from the parsed score" since
step 1, and the obvious reading of this step is to finally write
`keyboardRangeForScore(score)`. Do not. There is exactly one score in the app, imported
directly by `App.tsx` at compile time, and no way to load another. Every branch of such a
function except the one that returns this piece's range would be unreachable, and clamping to
a real piano's bounds would guard against a score that cannot exist.

The same safety comes from a test: assert that every pitch in `cichaNocScore` falls inside the
constant. That is the only thing a derivation would buy, and it is one assertion rather than a
module. When score loading actually arrives, derive it then, against a real second score.

## In scope

- `src/config.ts` becomes:

  ```ts
  /** Four octaves, C2-B5. Wide enough for cicha-noc.musicxml (48-67) and octave-aligned. */
  export const KEYBOARD_RANGE = { low: 36, high: 83 } as const;
  ```

  The stale comment goes with it. 48 keys, 28 of them white.

- Starting on a C and ending on a B is the part that does the visual work — a keyboard that
  stops on a G is most of what makes the current one look wrong. Keep that true of whatever
  range is chosen.
- Re-check `.piano-keyboard`'s fixed `height: 120px` against 28 white keys instead of 12. A key
  roughly a third of its former width at the same height is a different shape, and this is a
  judgement to make with the rendered page in front of you rather than in advance. Adjust if it
  reads badly, and say in the report which you did and why.

## Out of scope

- Deriving the range, per the decision above.
- Narrowing the keyboard to the selected loop range, scrolling it, or zooming it.
- Always rendering all 88 keys. Four octaves of a piece that uses two is generous framing;
  eight would make every key a sliver to make a point.
- Labelling the keys (step 13) or highlighting them (step 10).

## Decisions to record in `DECISIONS.md`

- The range is a constant with a test rather than a derivation, and what would have to change
  for that to stop being the right answer — a second score.
- Octave alignment is the part that does the visual work.

## Gate

- Layer 2: every pitch in `cichaNocScore.events` falls within `KEYBOARD_RANGE`, and the range
  starts on a C and ends on a B. Those two assertions are what make the constant safe; without
  the first, a wider piece would silently render keys that omit the notes being asked for, and
  from step 10 onward that is a missing instruction rather than a cosmetic problem.
- Layer 3: assert the rendered keyboard has 48 keys, 28 of them white. A count is a sharper
  assertion than a picture here and does not need updating when a colour changes.
- **No committed screenshot in this step.** Step 10 introduces the first keyboard screenshot,
  once the width is settled — otherwise the snapshot is taken twice and reviewed twice for one
  feature. Sequencing this step first exists precisely to avoid that.

## Manual

Revise `MANUAL-CHECKS.md` item 3 in place — the list stays at about ten items. It becomes:
play a single note, confirm the matching key highlights and un-highlights, and confirm the
keyboard spans four octaves starting on a C, with every note the piece asks for falling inside
it.
