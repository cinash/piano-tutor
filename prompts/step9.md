# Step 9 — A keyboard the size of a piano

Depends on step 2. One branch, `step-9-keyboard-range`, off `main`.

## Goal

The on-screen keyboard is 20 keys — C3 to G4, under two octaves, ending mid-octave on a G with
no A or B after it. Next to a real 88-key instrument it reads as stunted rather than as a
piano, and it is the first thing on screen a player compares against what is under their hands.
Make it wider, and let the player choose how wide.

## Confirmed decision — the width is a control, and no derivation

The player asked for the width to be configurable, when offered a choice between a fixed four
octaves, a fixed five and a fixed 88 — so the control is requested rather than invented.

The range is not derived from the score. There is one score in the app, imported by `App.tsx`
at compile time and no way to load another, so a `keyboardRangeForScore()` would be branches
that cannot run. The presets below are chosen so every one of them already contains the piece.

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
- `src/config.ts`'s `KEYBOARD_RANGE` becomes `KEYBOARD_PRESETS`, plus a named
  `DEFAULT_KEYBOARD_PRESET` pointing at the four-octave entry — not a `default: true` flag on
  one of them. The stale "until step 2 derives it from the parsed score" comment goes with it.
- `DECISIONS.md` already carries an entry saying the keyboard range is hardcoded to C3–G4 "for
  now", pending step 2. Revise that entry in the same commit rather than adding two new ones
  beside it that say the opposite.
- Re-check `.piano-keyboard`'s fixed `height: 120px` against the new widths. A white key is
  about 45 px wide at four octaves and about 24 px at 88 keys, against a fixed 120 px of
  height; at some point that stops looking like a piano. This is the one visual judgement no
  assertion in the gate can make, and "make it look nice" was half the request — so make it
  with the rendered page in front of you, and say in the report what you changed and why.

## Watch out — the presets must all contain the piece

From step 10 onward the keyboard carries the "which key to play" cue, so a pitch outside the
rendered range is not a cosmetic problem but a silently missing instruction. The narrowest
preset (36–83) already contains Cicha Noc's 48–67 with room either side, so this holds **by
construction** rather than by a runtime check — which is why the presets are a fixed list and
not a free low/high pair the player can type a bad value into.

The Gate below owns the assertion that keeps it true.

## Out of scope

- Deriving the range from the score, per the decision above.
- Free numeric low/high inputs, or a continuous zoom. The fixed list is what keeps the
  containment guarantee free.
- Remembering the choice across reloads. Nothing in the app is remembered except the attempt
  history; if that starts to grate, persistence is its own small decision.
- Narrowing the keyboard to the selected loop range, or scrolling it.
- Labelling the keys (step 13) or highlighting them (step 10).

## Decisions to record in `DECISIONS.md`

- The width is player-configurable because it was asked for, from a fixed list of presets
  rather than free input, and every preset contains the score by construction.
- No derivation from the score, and what would have to change for that to become the right
  answer — a second score.

## Gate

- Layer 2: every pitch in `cichaNocScore.events` falls inside every preset. That is the one
  assertion making the fixed list safe — it catches a narrow preset added later, or a wider
  piece arriving. Do not also assert that each preset's bounds sit on the octave boundary it
  claims: that checks three hand-written constants against arithmetic on the same constants.
- Layer 3: assert the default renders 48 keys, 28 of them white; switch the select to 88 keys
  and assert 88 keys, 52 white. A count is a sharper assertion than a picture here, and does
  not need updating when a colour changes.
- No committed screenshot. Step 13 takes the one keyboard screenshot, once the element is
  finished; key counts are the sharper check here anyway.

## Manual

Revise `MANUAL-CHECKS.md` item 3 in place — the list stays at about ten items. It becomes:
play a single note, confirm the matching key highlights and un-highlights, then switch the
keyboard to 88 keys and confirm it still tracks the right key and that the on-screen keyboard
now matches the P-145 under your hands.
