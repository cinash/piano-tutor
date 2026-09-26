# Step 27 — Where each hand sits

Shades, on the on-screen keyboard, the five keys each hand is placed over, and marks each of
them with the finger that rests on it, worked out from the fingering the score already carries.
Adds `src/keyboard/handPosition.ts` and `src/keyboard/handPosition.test.ts`; touches
`src/keyboard/PianoKeyboard.tsx`, `src/keyboard/PianoKeyboard.css`,
`src/keyboard/PianoKeyboard.test.tsx`, `src/App.tsx`, `src/App.test.tsx`, a new
`e2e/hand-position.spec.ts`, `e2e/virtualKeyboard.ts`, the committed keyboard screenshot
`e2e/note-names.spec.ts-snapshots/piano-keyboard-chromium-linux.png`, `DECISIONS.md` and item 3
of `MANUAL-CHECKS.md`. No dependency. Whether the parser changes waits on open question 2.
Independent of step 22. One branch, `step-27-hand-position`, off `main`, in **two commits**, each
passing `npm run ci` and each through the code review on its own (below).

## Goal

The player's ask: "a feature that shows on the keys which fingers should be used … and how the
hand should be placed." Today the keyboard lights the key to press in the hand's colour, and the
finger lives only in the queue above it, as a coloured circle with no key attached. A child
reading the keyboard learns where to press but not with what, and never sees where the rest of
the hand should be waiting.

## Confirmed decision — the hand's position, not a drawing of a hand

Offered three options — a finger number on the key to press, the five-key position of each hand
with a number on each key, or a hand outline drawn over the keys — the owner chose **the
position**, numbers on all five keys included.

Rejected: **a drawn hand** (an SVG silhouette placed over the keys). It covers the keys it is
meant to point at, has to be refitted to each of the three keyboard widths, and says nothing a
shaded row with numbers does not. It can be revisited if the shaded row proves hard to read.

## Two commits

The number on the key to press is not the same code as the position with one key instead of
five: it needs no derivation, no stepping rule and none of the traps below, only a numeral read
from the `expectedNotes` the keyboard already receives. It is also most of the value of "which
finger". So it lands first, on its own:

1. **The finger on the key to press.** Each expected key shows its `note.finger` and carries
   `data-finger`. Nothing else changes.
2. **The position.** `handPosition.ts`, the tint, the other four numbers, and the wiring.

That leaves the second commit holding only the part worth arguing about.

## How a position is worked out

`cicha-noc.musicxml` puts a `<fingering>` on every note, and the parser already reads it into
`Note.finger` (`src/score/parseScore.ts:166`). A finger on a key fixes the other four by stepping
from it one scale step per finger:

- **Right hand:** finger 1 is lowest. Finger _k_ sits _k − f_ steps from a note played by finger
  _f_.
- **Left hand:** finger 5 is lowest. Finger _k_ sits _f − k_ steps from it.

**What a step is waits on open question 2.** Stepping along the white keys is correct only for
pieces in C major (or A minor) without accidentals: in F major a thumb on F puts finger 4 on B
where the hand plays B♭, and in D major a thumb on D puts 3 on F where it plays F♯, with the
anchor itself white and nothing in the suite noticing, because Cicha Noc is in C. Stepping along
the **key signature** — the parser reads `<fifths>`, about a line, and the step table follows from
it — is right in any key, not for accidentals, and gives Cicha Noc exactly the same positions. A
third rule, **letting the hand's own upcoming notes fill the fingers they name** and stepping only
for the rest, is right for accidentals too, and is more code than either.

Which note a hand's position comes from: **that hand's next fingered note at or after
`nextEventIndex`**. That is where the hand should be ready, so a move shows as the shaded row
jumping the moment the last note of the old position is played. Worked through the piece — the
bars below are where each hand **plays** in each position:

| Hand  | Bars              | Position | Anchored on |
| ----- | ----------------- | -------- | ----------- |
| Right | 1-2, 11-12, 15-16 | E4-B4    | thumb on E4 |
| Right | 5-6, 17-18        | B4-F5    | thumb on B4 |
| Right | 9-10, 13-14, 19   | A4-E5    | thumb on A4 |
| Left  | 3-4, 8            | E3-B3    | 5 on E3     |
| Left  | 7                 | F3-C4    | thumb on C4 |
| Left  | 19-22             | C3-G3    | 5 on C3     |

Bar 7 to bar 8 is a real move and back: the thumb reaches up to C4 and the hand returns for G3 on 3. The rule shows it as two jumps, which is what the hand does.

Where each hand is **shown** differs, and depends on open question 3. Under "next fingered note",
an idle hand shows where it comes in next: the left hand from bar 1, and — after bar 8's G3 —
C3-G3 held through the whole middle of the piece, bars 9-18, until bar 19. The right hand has no
note after bar 19, so its tint disappears for bars 20-22.

Rejected: **one position per phrase**, chosen so that it covers every note in the phrase. It
shows fewer jumps, but needs a notion of phrase the score does not carry, and it would place the
hand where no single note says to. **Fingering generated by the app** for notes that have none:
this piece has none missing, and it is a research problem of its own.

## What is drawn

For each hand with a position, its five keys get a **light tint of the hand's colour** (amber for
right, teal for left, lighter than the existing expected-key colours, and clear of the held sky
blue; the exact shades are the implementer's, judged by the owner at the manual check), and each
of the five shows its finger number, bold, **above** the note name that step 13 put at the bottom
of every white key. The key the engine is waiting for keeps its strong hand colour and its number;
a held key keeps its held colour and its number. Keys between the five that no finger rests on
are not tinted. The swatches under the keyboard stay as they are: the tint is the same hue as the
swatch, and the number on it says what it is.

Rejected: **the finger number replacing the note name** on the positioned keys. It avoids a
crowded bottom strip on keys as narrow as 1/52 of the keyboard at 88 keys, but takes the name
away exactly where the child is looking. If stacking proves unreadable at 88 keys, the manual
check is where that shows, and replacing is the fallback.

Two `data-` attributes carry the truth for the tests, as the existing ones do:
`data-position-hand` (`'left'` or `'right'`, as `data-hand`) and `data-finger` (`1`-`5`).

`PianoKeyboard` gains one prop, the positions to draw as `{ pitch, hand, finger }[]`, computed in
`App.tsx` beside `expectedNotes` from the **filtered** score and `nextEventIndex`, so "Left hand"
practice shows only the left hand's position. It is empty past the end of the piece. During Listen
it waits on open question 4.

## Traps, and what this step does about each

- **A black-key anchor** under white-key stepping has no meaning. If question 2 keeps white-key
  stepping, `handPosition` returns **no position** for that hand at that point — one check, with a
  Layer 1 case over a hand-built score — rather than guessing. Under key-signature stepping a
  black key in the key is an ordinary step, and an accidental anchor gets the same no-position
  answer.
- **A same-hand chord** fixes the position twice, possibly inconsistently. This piece has none,
  and nothing is built for it: the anchor is the hand's first fingered note in the event as the
  parser orders it. Recorded in `DECISIONS.md` so the second piece that has one finds it.
- **Two hands on one key** (both thumbs on middle C, the commonest beginner position) cannot
  happen in this piece. The drawing takes the first entry for a pitch, and the right hand's are
  listed first. Recorded beside the chord rule; a second piece that needs both numbers on one key
  revisits it.
- **A position that runs off the keyboard.** The narrowest preset starts at C2, and the lowest
  position here is C3-G3, so it does not occur; a key outside the range is simply not drawn.
- **Loop wrap.** "Next note at or after the index" is linear, as `upNext` is
  (`src/practice/practiceView.ts:64`, DECISIONS.md, "deliberately linear"): on the last event of a
  loop an idle hand may show a position from beyond the loop. Accepted, for the same reason.
- **Note names.** Step 13 owns the committed keyboard screenshot, taken at page load at the
  default preset. It is re-taken once, in the second commit. It does not cover the 88-key preset,
  where the strip is narrowest; the manual check does.

## In scope

The two commits above, their tests, and the re-taken screenshot.

## Out of scope

- **Fingering for notes that have none.** A note with no `finger` contributes nothing, and the
  hand takes its position from its next fingered note. Every note in this piece is fingered.
- **Changing the queue.** Its finger circles stay as step 4 left them. With the numbers on the
  keys it is partly redundant, and folding it (step 18) is already the player's control for that.
- **Thumb-under and finger crossings.** The rule re-anchors on every note, so a scale with a
  thumb-under shows as a jump per crossing. Correct, if busy. None occurs in this piece.

## What this makes harder later

No persisted state, no exported format, no `localStorage` key: nothing here is one-way. Three
futures were played forward. **More pieces (step 22)** are where the stepping rule, the chord rule
and the shared-key rule are tested; each is written down above rather than invented then. **A
harder arrangement** (broken chords, stretches) turns re-anchoring on every note into the tint
jumping on almost every note; the escape is a hide toggle like step 18's, a new stored setting,
which is its own step. **Tempo in practice returning** reopens question 1: an instant jump is
safe only while the engine waits.

## Open questions for the owner

1. **Warn before a move?** (a) No warning: the tint jumps to the new position when the last note of
   the old one is played. Practice is untimed wait-mode (DECISIONS.md, "Practice is untimed"), so
   the jump always leaves the child as long as they need (recommended). (b) A line under the
   keyboard, "Next: right thumb to B4". (c) The next position drawn as an outline while the
   current one is still in use. (a) and (b) leave this step as written, (b) as a follow-up; (c)
   changes what this step draws, so the second commit waits on this answer.
2. **Will the pieces after Cicha Noc have black keys in a hand's position** — keys like F, G or D
   major — or stay white-key positions like this one? Black keys likely, or unsure: step along the
   key signature, a line in the parser (recommended; it costs little and Cicha Noc gives identical
   output to check it against). Staying white: step along the white keys and record that it is
   right for C major only. If white-key stepping is chosen and black-key pieces arrive, every such
   piece shows the hand on wrong keys with a green suite.
3. **The idle hand.** (a) Always show where it comes in next — which in this piece means both hands
   are tinted almost throughout, the left on C3-G3 for bars 9-18 while it rests (recommended: it is
   where the hand should wait). (b) Only in the bar before it comes in. (c) Only while it plays.
   If (a) is wrong the resting tint is noise; each alternative is a filter and a changed Layer 1
   case.
4. **During Listen.** (a) The keyboard shows only what sounds, as now (recommended for this step).
   (b) The positions follow the demo, so the child watches the hands move before playing. Step 17
   blanked the expected keys during the demo because they are "a second instruction at the same
   time" (`App.tsx:477`); a resting tint is not an instruction to press anything, so that reason
   does not carry over, and (b) is arguably what Listen is for. The step's instructions hold under
   either answer except for one line of wiring, so this is recorded as a precondition: under (a)
   positions are empty while `demoStep` is set; under (b) they are computed from the demo's
   current event.

## Decisions to record in `DECISIONS.md`

A new entry: a hand's position is five keys fixed by one fingered note, stepping by the rule
question 2 chose; it comes from the hand's next fingered note; the key to press keeps the strong
colour and the rest of the position a light one; a same-hand chord anchors on its first fingered
note and a shared key shows the right hand's number, both until a piece needs otherwise. Amend
"The keyboard says which key, the falling-note queue says which finger" (line 99) and "The keyboard
is coloured by hand, the queue by finger" (line 126): the keyboard now carries finger numbers too,
as plain numerals, and the queue keeps its finger colours.

## Gate

**Commit 1, Layer 2**, `PianoKeyboard.test.tsx`: an expected key shows its finger and carries
`data-finger`, and still carries its strong expected class. Fails without the commit.

**Commit 2, Layer 1**, `src/keyboard/handPosition.test.ts`, against the parsed `cicha-noc` score:
at the first event, right hand E4-B4 on 1-5 and left hand E3-B3 on 5-1; at bar 5's first event the
right hand is B4-F5; at bar 7 the left is F3-C4 and at bar 8 E3-B3 again; past the last event,
nothing. **The bar-5 case fails if positions are taken from a hand's first note instead of its
next one**, and the bar-7 case fails if the left hand is numbered like the right. Plus the
no-position case for an anchor the rule cannot step from, over a hand-built score. Under
key-signature stepping, a parser case that Cicha Noc reads `fifths` 0, and a hand-built F-major
case that finger 4 above a thumb on F lands on B♭.

**Commit 2, Layer 2**, `PianoKeyboard.test.tsx`: given a position, those five keys carry
`data-position-hand` and `data-finger`, the black keys between them carry neither, the expected
key keeps its strong class and its number, and a held key in the position keeps its
`data-finger`. `App.test.tsx`: with "Left hand" selected no key carries
`data-position-hand="right"`; while the demo runs, positions follow question 4's answer.

**Commit 2, Layer 3**, `e2e/hand-position.spec.ts` over the virtual keyboard (extend
`KEY_FOR_PITCH` in `e2e/virtualKeyboard.ts` with E3 and A3 for bars 3-4): at start the right
hand's five keys show 1-5, and after playing through bar 4 the right hand's shaded keys have moved
to B4-F5. Nothing in the suite knows whether the numbers are readable, or whether the key to press
still stands out among the tinted ones; that is manual.

## Manual

Item 3, which already checks the keyboard's marking by hand: while playing Cicha Noc through,
confirm the shaded keys match where the hand actually sits, that each move is clear when it
comes, that the key to press still stands out among the tinted ones, and — at the **88 keys**
preset — that the finger numbers and note names are both readable at the distance the child sits
from the screen.

## Finally

Add the step to `prompts/README.md` (done with this brief); move it to Shipped when it lands.
