# Step 9 — A keyboard the size of a piano

Depends on step 2. One branch, `step-9-keyboard-range`, off `main`.

## Goal

The on-screen keyboard is 21 keys — C3 to G4, under two octaves, ending mid-octave on a G with
no A or B after it. Next to a real 88-key instrument it reads as stunted rather than as a
piano, and it is the first thing on screen a player compares against the thing under their
hands. Derive the range from the score instead, wide enough and octave-aligned.

This also closes a loose end rather than adding a feature: `src/config.ts` has said
"hardcoded... until step 2 derives it from the parsed score" since step 1. Step 2 shipped and
did not.

## Confirmed decision — derive it, do not just bump the two constants

Changing `{ low: 48, high: 67 }` to a wider pair would look better in the same afternoon and
leave the same latent bug: any piece whose pitches fall outside the window renders keys that
do not include the notes being asked for. Step 10 puts the "which key to play" cue on this
keyboard, so from the next step onward an off-window pitch is not a cosmetic problem but a
silently missing instruction.

## In scope

- `keyboardRangeForScore(score)` in `src/keyboard/keyboardRange.ts`, returning
  `{ low, high }`:
  - take the lowest and highest pitch across every note of every event;
  - expand outward to octave boundaries, so the range starts on a C and ends on a B — a
    keyboard that stops on a G is most of what makes the current one look wrong;
  - keep widening symmetrically, a whole octave at a time, until it spans at least
    `MIN_OCTAVES` (4);
  - clamp to a real piano's bounds, MIDI 21 (A0) to 108 (C8), and accept the resulting
    asymmetry at the extremes rather than refusing to clamp.

  For Cicha Noc (48–67) that gives C2–B5, MIDI 36–83: four octaves, 48 keys, 28 of them white.

- Delete `KEYBOARD_RANGE` and its stale comment from `src/config.ts`; `App.tsx` derives the
  range from `cichaNocScore` and passes `low`/`high` to `PianoKeyboard` as it does today. If
  that leaves `config.ts` empty, delete the file — a config module holding nothing is worse
  than no config module.
- Re-check `.piano-keyboard`'s fixed `height: 120px` against 28 white keys instead of 12. A
  key roughly a third of its former width at the same height is a different shape, and this is
  a judgement to make with the rendered page in front of you, not in advance. Adjust the
  height if it reads badly; say in the report which you did and why.

## Watch out for an empty score

`computeKeyboardLayout` throws when `highNote < lowNote` or the range holds no white key, and
`Math.min()` over an empty list of pitches returns `Infinity`, which would reach it. Do **not**
add a runtime guard for that: the only score in the app is bundled and non-empty, and
CLAUDE.md is explicit that a guard on an unreachable state is dead defensive code. Pin the real
score's range with a Layer 2 test instead, and note the `Infinity` edge in the function's
comment so whoever adds score loading later meets it in the source rather than in a stack
trace.

## Out of scope

- Narrowing the keyboard to the selected loop range, scrolling it, or zooming it.
- Always rendering all 88 keys regardless of the score. Four octaves of a piece that uses two
  is generous framing; eight would make every key a sliver to make a point.
- Labelling the keys (step 13) or highlighting them (step 10).

## Decisions to record in `DECISIONS.md`

- The keyboard range is derived, octave-aligned, at least four octaves, clamped to 21–108 —
  and why octave alignment is the part that does the visual work.
- No empty-score guard, per the section above.

## Gate

- Layer 1/2: `keyboardRangeForScore` over a narrow score (widened to the minimum), a score
  already wider than the minimum (not shrunk), one whose extremes sit exactly on a C and a B
  (not widened by a spurious extra octave), and one pushed against MIDI 21 and 108 (clamped).
  Plus one test asserting the real `cichaNocScore` yields 36–83, so the number in this
  document and the number in the code cannot drift apart silently.
- Layer 3: assert the rendered keyboard has 48 keys, 28 of them white, that the first is a C
  and the last a B. A count is a sharper assertion than a picture here and does not need
  updating when a colour changes.
- **No committed screenshot in this step.** Step 10 introduces the first keyboard screenshot,
  once the width is settled — otherwise the snapshot is taken twice and reviewed twice for one
  feature. Sequencing this step first exists precisely to avoid that.

## Manual

Revise `MANUAL-CHECKS.md` item 3 in place — the list stays at about ten items. It becomes:
play a single note, confirm the matching key highlights and un-highlights, and confirm the
keyboard spans roughly four octaves starting on a C, with every note the piece asks for
falling inside it.
