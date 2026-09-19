# Step 9 — A keyboard the size of a piano

Depends on step 2. One branch, `step-9-keyboard-range`, off `main`.

## Goal

The on-screen keyboard is 20 keys — C3 to G4, under two octaves, ending mid-octave on a G with
no A or B after it. Next to a real 88-key instrument it reads as stunted rather than as a
piano, and it is the first thing on screen a player compares against what is under their hands.
Make it wider, and let the player choose how wide.

## Confirmed decision — the width is a control, and that was asked for

This is configurability, which CLAUDE.md is otherwise hostile to, so record why it belongs:
**the player asked for the width to be configurable** when choosing between a fixed four
octaves, a fixed five and a fixed 88. It is a requested feature, not a knob invented in case
someone wants it. A reviewer meeting this cold should read this paragraph before proposing to
replace the control with a constant.

What is _not_ in it: no derivation of the range from the score. There is one score in the app,
imported by `App.tsx` at compile time, and no way to load another, so a
`keyboardRangeForScore()` would be branches that cannot run. The presets below are chosen so
that every one of them already contains the piece.

## In scope

- Three presets, as an explicit list of ranges — not a computed span:
  - **4 octaves**, C2–B5 (MIDI 36–83): 48 keys, 28 white. The default.
  - **5 octaves**, C2–B6 (MIDI 36–95): 60 keys, 35 white.
  - **88 keys**, A0–C8 (MIDI 21–108): the P-145's own range, so what is on screen maps one to
    one onto what is under the player's hands.
- A `<select>` beside the keyboard, in the plain unstyled idiom `DevicePicker` and `LoopPicker`
  already use. `App.tsx` holds the choice in state and passes the chosen `low`/`high` to
  `PianoKeyboard`, which already takes exactly those two props — `computeKeyboardLayout` needs
  no change at all.
- `src/config.ts`'s `KEYBOARD_RANGE` becomes the preset list with the four-octave entry marked
  as the default; the stale "until step 2 derives it from the parsed score" comment goes.
- Every preset starts on a C or an A and ends on a B or a C. A keyboard that stops on a G is
  most of what makes the current one look wrong, and that stays true whichever one is picked.

## Watch out — the presets must all contain the piece

From step 10 onward the keyboard carries the "which key to play" cue, so a pitch outside the
rendered range is not a cosmetic problem but a silently missing instruction. The narrowest
preset (36–83) already contains Cicha Noc's 48–67 with room either side, so this holds **by
construction** rather than by a runtime check — which is why the presets are a fixed list and
not a free low/high pair the player can type a bad value into.

Pin it with a test rather than a comment: assert that every pitch in `cichaNocScore` falls
inside _every_ preset. That is the one assertion that would catch someone later adding a
narrow preset, or a wider piece arriving.

## Out of scope

- Deriving the range from the score, per the decision above.
- Free numeric low/high inputs, or a continuous zoom. The fixed list is what keeps the
  containment guarantee free.
- Remembering the choice across reloads. Consistent with step 13's refusal of a persisted
  toggle; if a second preference ever appears, persistence becomes its own small decision for
  both of them at once.
- Narrowing the keyboard to the selected loop range, or scrolling it.
- Labelling the keys (step 13) or highlighting them (step 10).

## Decisions to record in `DECISIONS.md`

- The width is player-configurable because it was asked for, from a fixed list of presets
  rather than free input, and every preset contains the score by construction.
- No derivation from the score, and what would have to change for that to become the right
  answer — a second score.

## Gate

- Layer 2: every pitch in `cichaNocScore.events` falls inside every preset; each preset starts
  and ends on the octave boundary it claims. Those are what make the fixed list safe.
- Layer 3: assert the default renders 48 keys, 28 of them white; switch the select to 88 keys
  and assert 88 keys, 52 white. A count is a sharper assertion than a picture here, and does
  not need updating when a colour changes.
- **No committed screenshot in this step.** Step 10 introduces the first keyboard screenshot,
  once the default width is settled — otherwise the snapshot is taken twice and reviewed twice
  for one feature. Sequencing this step first exists precisely to avoid that.

## Manual

Revise `MANUAL-CHECKS.md` item 3 in place — the list stays at about ten items. It becomes:
play a single note, confirm the matching key highlights and un-highlights, then switch the
keyboard to 88 keys and confirm it still tracks the right key and that the on-screen keyboard
now matches the P-145 under your hands.
