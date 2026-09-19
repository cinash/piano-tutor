# Step 11 — Tell the hands apart

Depends on step 10. One branch, `step-11-hand-colours`, off `main`.

## Goal

Say which hand plays each key the app is asking for. `Note.hand` has been parsed since step 2 —
`parseScore.ts` sets it from the MusicXML `<staff>`, staff 2 meaning left — and nothing in the
UI has ever read it: outside `src/score/`, every match for `hand` is a `handleSomething` event
handler. The data is already there, correct, and tested; this step spends it.

Left/right colour is the first thing a flowkey user looks for, and the opening chord of Cicha
Noc is the ideal case: G4 in the right hand over C3 and G3 in the left.

## Confirmed decision — hand colour on the keyboard, finger colour in the queue

Two colour systems on one screen is the real risk in this step. The split is: the **keyboard**
is coloured by hand, the **queue** stays coloured by finger. They answer different questions and
are never adjacent, and step 4's finger decision stands. Pick a hand palette plainly distinct
from `FINGER_COLORS` — not another violet or another pink — and label the two hand colours, so
the newer of the two systems is not the one left to be guessed at.

## In scope

This step adds no prop and changes no types. Step 10 already passes `readonly Note[]` to
`PianoKeyboard`, and `Note` carries `hand`, so everything needed is in the component already:

- Render `data-hand={expected?.hand}` beside the `data-expected` step 10 added, from the same
  `expected` lookup.
- `.piano-key--expected-left` / `.piano-key--expected-right`, each in a white and a black
  variant, replacing step 10's single expected colour. Held still wins over both, per step 10.
- Two swatches beside the keyboard labelling the hand colours.

That is the whole step: one attribute, four CSS rules and a legend.

## Out of scope

- Recolouring the queue circles by hand, or adding an L/R marker to them.
- Filtering practice to one hand — that is step 14, and it will consume this step's colours.
- Hand colours on _held_ keys. Held is about what you are doing, not what is being asked.
- A rule for the same pitch appearing in both hands at once. `parseScore.ts` keys ties on
  `` `${note.hand}-${note.pitch}` ``, so a cross-hand unison is representable — but Cicha Noc
  contains none, and the only score is bundled. Let the lookup find whichever comes first, and
  decide it when a piece needs it.

## Decisions to record in `DECISIONS.md`

- Hand colours on the keyboard, finger colours in the queue, and why they do not compete.

## Gate

- Layer 2: component test over a two-hand chord asserting each key carries the right
  `data-hand`, and one confirming held still wins. Assert the attribute, not the class — that
  is what `PianoKeyboard.test.tsx` already does for `data-held`, and it keeps the test about
  behaviour rather than about markup.
- Layer 3: connect the virtual keyboard and assert that at the start position pitch 67 is
  `data-hand="right"` while 48 and 55 are `data-hand="left"` — the opening chord tests this
  step for free.

## Manual

No new item. Extend the revised item 3 with one clause: confirm the hand colours match the hand
you actually play each note with, on a chord that uses both.
