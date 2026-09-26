# Step 27 — Where each hand sits

Shades, on the on-screen keyboard, the five keys each hand is placed over, marks each of them with
the finger that rests on it, and outlines where the hand goes next just before it has to move —
all worked out from the fingering and key signature the score already carries. Adds
`src/keyboard/handPosition.ts` and `src/keyboard/handPosition.test.ts`; touches
`src/engine/advance.ts`, `src/score/types.ts`, `src/score/parseScore.ts`, `src/score/parseScore.test.ts`, the parse snapshot
`src/score/fixtures/cicha-noc.snapshot.json`, the five test files that build a `Score` by hand
(`src/engine/advance.test.ts`, `src/practice/practiceView.test.ts`, `src/practice/demo.test.ts`,
`src/practice/positionReadout.test.ts`, `src/score/filterScoreByHand.test.ts`),
`src/keyboard/PianoKeyboard.tsx`, `src/keyboard/PianoKeyboard.css`,
`src/keyboard/PianoKeyboard.test.tsx`, `src/App.tsx`, `src/App.test.tsx`, a new
`e2e/hand-position.spec.ts`, the committed keyboard screenshot
`e2e/note-names.spec.ts-snapshots/piano-keyboard-chromium-linux.png`, `DECISIONS.md` and item 3
of `MANUAL-CHECKS.md`. No dependency. Independent of step 22. One branch,
`step-27-hand-position`, off `main`, in **three commits**, each passing `npm run ci` and each
through the code review on its own (below).

## Goal

The player's ask: "a feature that shows on the keys which fingers should be used … and how the
hand should be placed." Today the keyboard lights the key to press in the hand's colour, and the
finger lives only in the queue above it, as a coloured circle with no key attached. A child
reading the keyboard learns where to press but not with what, never sees where the rest of the
hand should be waiting, and is not told when it has to move.

## Confirmed decisions

Offered three options — a finger number on the key to press, the five-key position of each hand
with a number on each key, or a hand outline drawn over the keys — the owner chose **the
position**, numbers on all five keys included. Rejected: **a drawn hand** (an SVG silhouette over
the keys). It covers the keys it is meant to point at, has to be refitted to each of the three
keyboard widths, and says nothing a shaded row with numbers does not.

Asked the four open questions of the first draft, the owner answered:

1. **Warn before a move with an outline of the next position on the keys**, chosen from a text
   line under the keyboard ("Next: right thumb to B4"), the outline, or both, after seeing a
   mock-up of each. The text line is rejected: it makes the child look away from the keys to read.
2. **Step along the key signature**, because the pieces after Cicha Noc may be in other keys.
   Rejected: stepping along the white keys, which is right in C major only.
3. **The idle hand always shows where it comes in next.** Rejected: showing it only in the bar
   before it enters, or only while it plays.
4. **During Listen, the positions follow the demo**, so the child can watch the hands move before
   playing. This reverses step 17's rule that during a demonstration the only marks on the
   keyboard are what is sounding (`App.tsx:477`; DECISIONS.md, "The demo sounds one event at a
   time"). That rule kept the expected keys off because they are "a second instruction at the same
   time"; a resting tint is not an instruction to press anything. The expected keys stay blank
   during the demo as before.

## Three commits

Each stands on its own and each passes `npm run ci`, so each gets its own review:

1. **The finger on the key to press.** Each expected key shows its `note.finger` and carries
   `data-finger`. No derivation, no stepping rule and none of the traps below — a numeral read from
   the `expectedNotes` the keyboard already receives — and most of the value of "which finger".
2. **The position.** `Score.fifths`, `handPosition.ts`, the tint, the numbers on the other four
   keys, and the wiring in `App.tsx`, the demo and the loop included. The key signature lands here
   rather than alone, because on its own it is a field nothing reads.
3. **The outline of the next position.**

## How a position is worked out

The parser already reads every `<fingering>` into `Note.finger` (`src/score/parseScore.ts:166`),
and every note in `cicha-noc.musicxml` has one. A finger on a key fixes the other four by
stepping from it **one degree of the key's scale** per finger — the seven pitch classes of the
major scale that `fifths` names:

- **Right hand:** finger 1 is lowest. Finger _k_ sits _k − f_ scale degrees from a note played by
  finger _f_.
- **Left hand:** finger 5 is lowest. Finger _k_ sits _f − k_ scale degrees from it.

So in F major a thumb on F puts finger 4 on B♭, and in D major a thumb on D puts 3 on F♯. In C
major (`fifths` 0) it steps along the white keys, and Cicha Noc's positions are exactly those the
white-key rule gave. **`Score.fifths` is a required `number`**, read from the first
`<key><fifths>`, and 0 when a score has no `<key>` — no sharps or flats written, and
what `parseScore.test.ts`'s `scoreWithNotes()` helper produces. The five test files above that
build a `Score` literal gain `fifths: 0`. Rejected: an optional field defaulted in
`handPosition.ts`, which spreads "no key means C" to every reader.

A note outside the key — an accidental — cannot be stepped from: when it is the note fixing the
position, that hand has **no position** at that point rather than a guessed one. When it is not —
the raised seventh of a minor key, say G♯ in A minor under a finger the anchor stepped to — the
rule puts that finger's number on the key in the scale (G), where the hand does not play. That is
a known wrong shade, not a gap, and it is recorded in `DECISIONS.md` for the first piece that has
one. Rejected for now: **letting the hand's own upcoming notes fill the fingers they name**,
stepping only for the rest, which fixes it. It is more code, and no piece here has an accidental;
the first minor-key piece is where to build it.

**Which note fixes the position:** that hand's next fingered note, walking the events in the order
practice will reach them — from the current index forward, and with a loop set, from the loop's
end back to its first event, as `nextIndexAfter` does (`src/engine/advance.ts:108`), for one full
pass. So with bars 1-2 looped, the left hand, which does not play there, has no position, and the
right hand's E4 is followed by G4 again rather than bar 5's D5. `handPosition.ts` takes the loop
alongside the score and index, and walks with **the engine's own `nextIndexAfter`**, exported and
its parameter narrowed to `Pick<EngineState, 'nextEventIndex' | 'loop'>` — the two fields it
reads — so the tint and the engine cannot disagree about where a loop wraps. That adds
`src/engine/advance.ts` to the files touched. Rejected: a copy of the wrap in
`handPosition.ts`, which keeps the step out of `src/engine` but lets the two drift apart. The demo plays the whole filtered score, so during the demo no loop is
passed. Rejected: **walking linearly**, as `upNext` does in `src/practice/practiceView.ts:65`
(DECISIONS.md, "Loop selection: setting a loop doesn't jump playback, only changes where it
wraps"). That lookahead asks whether a pitch is plausibly what was meant next; a position asks
where the hand actually goes next, and a wrong one is an instruction on screen. Looping a
two-bar phrase is the natural drill in this piece, and nearly every phrase ends on the note
before a move.

Worked through the piece without a loop, the bars where each hand **plays** in each position:

| Hand  | Bars              | Position | Anchored on |
| ----- | ----------------- | -------- | ----------- |
| Right | 1-2, 11-12, 15-16 | E4-B4    | thumb on E4 |
| Right | 5-6, 17-18        | B4-F5    | thumb on B4 |
| Right | 9-10, 13-14, 19   | A4-E5    | thumb on A4 |
| Left  | 3-4, 8            | E3-B3    | 5 on E3     |
| Left  | 7                 | F3-C4    | thumb on C4 |
| Left  | 19-22             | C3-G3    | 5 on C3     |

Bar 7 is drawn as a move to F3-C4 and back. A teacher might call the thumb on C4 a one-key
extension of E3-B3 instead; keeping the current position for a note one key outside it is the
fallback if the manual check finds bar 7's jumps read as noise. Where each hand is **shown** is
wider: the left hand from bar 1, and on C3-G3 through the whole middle of the piece, bars 9-18,
while it rests. The right hand has no note after bar 19, so its tint disappears for bars 20-22.
Both are what the owner chose.

Rejected: **one position per phrase**, which needs a notion of phrase the score does not carry.
**Fingering generated by the app** for notes that have none: this piece has none missing, and it is
a research problem of its own.

## The next position

A hand's next position is drawn **only when that hand has a note in the event about to be played,
and the hand's following fingered note** (in the same loop-aware order) **fixes a different
position**. That following position is what is outlined. If the following note fixes no position
(an accidental), or the hand's note in the event has no finger, there is no outline. An idle hand never carries one: it gets its outline at the
note before its move, like the playing hand.

In Cicha Noc, without a loop, that is the right hand's E4 in bar 2 (next: B4-F5), its B4 in bar 6
(next: A4-E5), the left hand's E3 in bar 4 (next: F3-C4), its second C4 in bar 7 (next: E3-B3),
and so on. After the note is played the tint jumps onto the outline. With bars 1-2 looped, E4 has
no outline, because G4 follows it in the same position.

Rejected: **the next position drawn all the time.** There is almost always one, so the keyboard
would carry two positions per hand throughout — four in this piece, with both hands shown. The
owner saw the outline mock-up at the moment just before a move, which is when it is drawn.

## What is drawn

- **The position:** a **light tint of the hand's colour** (amber for right, teal for left, lighter
  than the existing expected-key colours, and clear of the held sky blue) on its five keys, each
  showing its finger number, bold, **above** the note name step 13 put at the bottom of every white
  key. A black key in a position (B♭ in F major) takes a black-key variant of the tint, as the
  expected-key colours already have one each, and its number sits at the bottom of the black key,
  in a colour readable on it. The expected key keeps its strong hand colour and its number; a held
  key keeps its held colour and its number. Keys between the five that no finger rests on are not
  tinted.
- **The next position:** a **dashed outline** in the hand's colour on its five keys, each showing
  its finger number faint, above the current number where a key is in both (B4 in bar 2 shows 5 and
  a faint 1).
- The swatches under the keyboard stay as they are: tint and outline are the swatch's hue, and the
  numbers say what they are. The exact shades are the implementer's, judged by the owner at the
  manual check. Cicha Noc has no black key in a position, so the black-key variant is seen only
  in the Layer 2 test until a piece has one.

Rejected: **the finger number replacing the note name** on positioned keys. It avoids a crowded
bottom strip on keys as narrow as 1/52 of the keyboard at 88 keys, but takes the name away exactly
where the child is looking. If stacking proves unreadable at 88 keys the manual check shows it, and
replacing is the fallback.

The tests read `data-` attributes, as the existing ones do: `data-finger` and `data-position-hand`
(`'left'` or `'right'`, as `data-hand`) for the position, `data-next-finger` and `data-next-hand`
for the outline.

`handPosition.ts` is a pure function of a score, an event index and an optional loop, returning
each hand's current and next position as `{ pitch, hand, finger }[]`. `PianoKeyboard` gains props
for the two lists. `App.tsx` computes them from the **filtered** score, so "Left hand" practice
shows only the left hand. In practice the index is `nextEventIndex` and the loop is the engine's.
**During the demo** the index is the first event whose `startTime` is at or after
`demoStep.startTime` — a `DemoStep` carries `startTime`, not an index (`src/practice/demo.ts:17`)
— so the silent steps between events show the hand where its next note will be. When the demo ends
or is stopped, `demoStep` goes null and the positions return to practice's index in the same
render. Past the end of the piece both lists are empty.

## Traps, and what this step does about each

- **Accidentals**, above: none in this piece; a Layer 1 case over a hand-built score pins the
  no-position case.
- **A key change mid-piece.** `fifths` is read from the first `<key>` only. Cicha Noc has one; a
  piece with a change steps by the first key throughout. Recorded in `DECISIONS.md`.
- **A same-hand chord** fixes the position twice, possibly inconsistently. None here, and nothing
  is built for it: the anchor is the hand's first fingered note in the event as the parser orders
  it. Recorded in `DECISIONS.md`.
- **Two hands on one key** (both thumbs on middle C, the commonest beginner position) cannot
  happen here. The drawing takes the first entry for a pitch, and the right hand's are listed
  first. Recorded beside the chord rule.
- **A position that runs off the keyboard.** The narrowest preset starts at C2 and the lowest
  position here is C3-G3; a key outside the range is simply not drawn.
- **Note names and the screenshot.** Step 13 owns the committed keyboard screenshot, taken at page
  load at the default preset, where G4 (finger 3) is the expected key and no outline is drawn.
  Commit 1 (the 3 on G4) and commit 2 (the tint and the other numbers) each change it, so each
  re-takes it; commit 3 does not. It does not cover the 88-key preset, where the strip is
  narrowest; the manual check does.

## Out of scope

- **Fingering for notes that have none.** Such a note contributes nothing, and the hand takes its
  position from its next fingered note.
- **Changing the queue.** Its finger circles stay as step 4 left them. With the numbers on the
  keys it is partly redundant; folding it (step 18) is already the player's control for that.
- **Thumb-under and finger crossings.** The rule re-anchors on every note, so a scale with a
  thumb-under shows a jump per crossing. Correct, if busy. None occurs here.
- **A text line naming the move**, rejected by the owner.

## What this makes harder later

No persisted state, no exported format, no `localStorage` key: nothing here is one-way. The
`fifths` field joins `Score`, which nothing stores. Four futures were played forward. **More
pieces (step 22)** are where the accidental, minor-key, key-change, chord and shared-key rules are
tested; each is written down above rather than invented then. **A piece with no fingering** —
public-domain MusicXML often has none — makes this whole step silently show nothing, and no test
notices. `step22.md` has no check that a bundled piece is fingered on every note yet; it should
gain one, and a note that a minor-key piece brings the fill-from-upcoming-notes rule with it, in a
change of its own through the planning gate.
**A harder arrangement** (broken chords, stretches) turns re-anchoring on every note into the tint
and outline changing on almost every note; the escape is a hide toggle like step 18's, a new
stored setting, which is its own step. **Tempo in practice returning:** the outline appears one
note before the move, which under a clock may be too late; it would then want to appear earlier.

## Decisions to record in `DECISIONS.md`

A new entry: a hand's position is five keys fixed by one fingered note, stepping by the key
signature's scale; `fifths` is the first key's, and 0 without one; an accidental anchor gives no
position, and an accidental under another finger is shaded on the scale's key — a known wrong
shade until a minor-key piece arrives; the position comes from the hand's next fingered note in
loop-aware order, so an idle hand shows where it comes in and a looped phrase shows no move that
does not happen; the next position is outlined only on the hand's last note before a move;
positions follow the demo, the expected keys do not; the key to press keeps the strong colour and
the rest a light one; a same-hand chord anchors on its first fingered note and a shared key shows
the right hand's number, both until a piece needs otherwise.

Amend four entries: "The keyboard says which key, the falling-note queue says which finger" (line 99) and "The keyboard is coloured by hand, the queue by finger" (line 126), because the keyboard
now carries finger numbers too, as plain numerals, and the queue keeps its finger colours;
"Listening is not practising" (line 736) and "The demo sounds one event at a time" (line 782),
because during the demo the keyboard now also shows where the hands sit.

## Gate

Each commit names the check that fails without it.

**Commit 1**, `PianoKeyboard.test.tsx`: an expected key shows its finger, carries `data-finger`, and
keeps its strong expected class.

**Commit 2.**

- `parseScore.test.ts`: Cicha Noc parses with `fifths` 0; a hand-built score with
  `<fifths>-1</fifths>` parses with −1; one with no `<key>` with 0.
- `src/keyboard/handPosition.test.ts` against the parsed `cicha-noc` score: at the first event,
  right hand E4-B4 on 1-5 and left hand E3-B3 on 5-1; at bar 5's first event the right hand is
  B4-F5; at bar 7 the left is F3-C4 and at bar 8 E3-B3 again; past the last event, nothing. **The
  bar-5 case fails if positions are taken from a hand's first note instead of its next one**, and
  the bar-7 case fails if the left hand is numbered like the right. With bars 1-2 looped: at the
  first event, no left-hand position — **the case that fails under a linear walk**. Over hand-built
  scores: in F major (`fifths` −1) finger 4 above a thumb on F lands on B♭ — **the case that fails
  under white-key stepping** — and an accidental anchor gives no position.
- `PianoKeyboard.test.tsx`: the five keys of a position carry `data-position-hand` and
  `data-finger`, the black keys between them neither, the expected key keeps its strong class and
  number, a held key keeps its `data-finger`, and a black key in a position carries both.
- `App.test.tsx`: with "Left hand" selected, E3-B3 carries `data-position-hand="left"` and no key
  carries `data-position-hand="right"`. With the
  demo started and run forward to bar 5, as the existing case does at `App.test.tsx:177`
  (`advanceTimersByTime(12_728)`), the right hand's position is B4-F5 and no key is marked expected
  — **the case that fails if the demo wiring is missing**, since at the demo's first step it and
  practice agree. After Stop, the right hand's position is E4-B4 again.
- `e2e/hand-position.spec.ts` over the virtual keyboard: at start the right hand's five keys show
  1-5; after playing bar 1 they still do; after playing bar 2's E4 they have moved to B4-F5. No new
  keys are needed in `e2e/virtualKeyboard.ts`. With bars 1-2 looped through the existing
  `selectLoopRange(page, 1, 2)`, no key carries `data-position-hand="left"` — **the case that
  fails if `App.tsx` does not pass the loop**, since Layer 1 alone tests the walk.

**Commit 3.**

- `handPosition.test.ts`: at bar 1's first event the right hand has no next position; at bar 2's
  E4 it is B4-F5 on 1-5; at bar 7's second C4 the left hand's is E3-B3; with bars 1-2 looped, bar
  2's E4 has none.
- `PianoKeyboard.test.tsx`: the outlined keys carry `data-next-hand` and `data-next-finger`, and a
  key in both carries `data-finger` and `data-next-finger`.
- The e2e spec: after playing bar 1, B4-F5 is outlined and B4 carries `data-finger` 5 and
  `data-next-finger` 1; after playing E4 the outline is gone and the tint is on B4-F5.

Nothing in the suite knows whether the numbers are readable or whether the key to press still
stands out among the tinted ones; that is manual.

## Manual

Item 3, which already checks the keyboard's marking by hand: while playing Cicha Noc through,
confirm the shaded keys match where the hand actually sits, that the outline shows each move in
time to see it coming, that the key to press still stands out among the tinted ones, and — at the
**88 keys** preset — that the finger numbers and note names are both readable at the distance the
child sits from the screen. Press Listen and
confirm the shaded positions move with the demo.

## Finally

Add the step to `prompts/README.md` (done with this brief); move it to Shipped when it lands.
