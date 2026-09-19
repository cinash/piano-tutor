# Step 11 — Tell the hands apart

Depends on step 10. One branch, `step-11-hand-colours`, off `main`.

## Goal

Say which hand plays each key the app is asking for. `Note.hand` has been parsed since step 2
— `parseScore.ts` sets it from the MusicXML `<staff>`, staff 2 meaning left — and **nothing in
the UI has ever read it**. A grep for `hand` across `src/` returns only `handleEvent` and
`handleKeyDown`. The data is already there, correct, and tested; this step spends it.

Left/right colour is the first thing a flowkey user looks for, and the opening chord of Cicha
Noc is the ideal case: G4 in the right hand over C3 and G3 in the left.

## Confirmed decision — hand colour on the keyboard, finger colour in the queue

Two colour systems on one screen is the real risk in this step. The split is: the **keyboard**
is coloured by hand, the **queue** stays coloured by finger. They are answering different
questions and are never adjacent, and step 4's finger decision stands. Pick a hand palette
plainly distinct from `FINGER_COLORS` — not another violet or another pink — and render a
legend so neither system has to be guessed at.

## In scope

- `PianoKeyboard`'s `expectedNotes` prop becomes `ReadonlyMap<number, Hand>` instead of a set
  of pitches; `App.tsx` builds it from `expectedNotes(view, score)`, which already returns
  `Note[]`. The key renders `data-hand` alongside `data-expected`.
- `.piano-key--expected-left` / `.piano-key--expected-right`, each in a white and a black
  variant. Held still wins over both, per step 10.
- A small legend beside the keyboard: two swatches, "left hand" and "right hand".

## Watch out for one pitch in both hands at once

`parseScore.ts` keys its tie-tracking on `` `${note.hand}-${note.pitch}` ``, which means the
same pitch in both hands within one event is representable, not impossible — a chord where the
hands meet on a unison. A `Map<number, Hand>` silently keeps whichever was inserted last, which
is the arrival order of the notes array: an invisible rule that will one day render the wrong
colour with nothing to point at.

Decide it explicitly and write it down. The suggested rule is that the **lower-numbered staff
wins** (right hand), because that is the one the melody is in and the note a player is most
likely looking for. Cicha Noc has no such chord, so this is a decision made now in daylight
rather than a bug found later in the dark.

## Out of scope

- Recolouring the queue circles by hand, or adding an L/R marker to them.
- Filtering practice to one hand — that is step 14, and it will consume this step's colours.
- Hand colours on _held_ keys. Held is about what you are doing, not what is being asked.

## Decisions to record in `DECISIONS.md`

- Hand colours on the keyboard, finger colours in the queue, and why they do not compete.
- The unison collision rule chosen above, with its reasoning.

## Gate

- Layer 2: component test over a two-hand chord asserting each key carries the right
  `data-hand` and class; one over a unison chord pinning the collision rule; one confirming
  held still overrides both.
- Layer 3: connect the virtual keyboard and assert that at the start position pitch 67 is
  `data-hand="right"` while 48 and 55 are `data-hand="left"` — the opening chord tests this
  step for free.
- Update the `piano-keyboard` screenshot from step 10. It is the same element and the same
  moment; the colours are what changed.

## Manual

No new item. Extend the revised item 3 with one clause: confirm the hand colours match the
hand you actually play each note with, on a chord that uses both.
