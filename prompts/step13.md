# Step 13 — Note names on the keys

Depends on steps 9 and 10. One branch, `step-13-note-names`, off `main`.

## Goal

Give the keyboard an orientation grid. Once the keys light up (step 10) a player can follow the
piece, but they still cannot say what they just played, connect it to a printed score, or find
a note by name when asked. Labels turn the keyboard from a signal into a reference.

## Confirmed decision — sharps only, and why that is a limitation rather than a choice

`Note` carries `pitch`, `hand` and `finger`. The MusicXML spelling — whether the composer wrote
B♭ or A♯ — is read by `parseScore.ts` to compute the pitch and then discarded. Names must
therefore be derived from the MIDI number alone, and the only consistent derivation is sharps.

In a flat key that is simply wrong to a reader: the app will print A♯ where the score says B♭.
Record it as a known limitation, not a defect. Fixing it means carrying the spelling through
step 2's parser and into `Note`, which is its own step with its own parser tests, and is not
smuggled into this one.

## In scope

- `noteName(pitch)` in `src/keyboard/noteName.ts`, in scientific pitch notation with middle C
  at 60 as `C4` — the convention `config.ts` already used when it called 48 "C3".
- **White keys are labelled, black keys are not.** A black key is about 27 px wide at this
  keyboard's four-octave width, which does not hold `C♯4`, and truncating it to `C♯` puts an
  unoctaved label next to octaved ones. A black key's identity is readable from its white
  neighbours, which is how a player finds it on the real instrument too.
- A "Show note names" checkbox, defaulting to **on**. The player who most needs the labels is
  the one least likely to find the switch that reveals them.
- Labels are orientation, not instruction: every white key is labelled, not only the expected
  ones.

## Out of scope

- Flats, key-signature-aware spelling, or solfège — all blocked on the parser change above.
- Labelling black keys, per the decision above.
- Persisting the checkbox across reloads. It is one click, and `localStorage` here would be the
  first per-viewer preference in the app — worth its own decision if a second one ever appears.

## Decisions to record in `DECISIONS.md`

- Sharps only, because the parser discards MusicXML spelling; what fixing it would cost.
- White keys only, with the width reasoning.

## Gate

- Layer 1/2: `noteName` across a full octave, at both ends of the keyboard's range, and at the
  C boundaries where the octave number increments — 59 is `B3` and 60 is `C4`, which is the
  off-by-one this function exists to get right.
- Layer 2: component test asserting white keys carry labels, black keys carry none, and that
  the checkbox removes them.
- Layer 3: assert a known key reads `C4`, toggle the checkbox, assert the labels are gone.
- Update the `piano-keyboard` screenshot from steps 10 and 11 — labels on by default change
  what that element looks like.

## Manual

No new item. The existing keyboard check covers it by eye; a label that is wrong will be
obvious to anyone who can already read the keyboard.
