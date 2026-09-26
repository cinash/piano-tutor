# Step 24 — The left hand plays an octave lower

Moves every left-hand note of `cicha-noc.musicxml` down one octave, draws the left-hand staff in
bass clef, and corrects the left hand's fingering in bars 19-22. Touches `cicha-noc.musicxml`, its parse snapshot
`src/score/fixtures/cicha-noc.snapshot.json`, the tests that name left-hand pitches
(`src/App.test.tsx`, `src/score/parseScore.test.ts`, `e2e/virtualKeyboard.ts`,
`e2e/hand-colours.spec.ts`, `e2e/one-hand-practice.spec.ts`, and any other the suite turns up), a comment in `src/config.ts`, the step 21 paragraph of `prompts/README.md`, the step 21 entry and the keyboard-presets entry (line 86) in `DECISIONS.md`
and items 3 and 11 of `MANUAL-CHECKS.md`. No code under `src/` changes behaviour and no
dependency is added. Independent of steps 25 and 26. One branch, `step-24-left-hand-octave`,
off `main`.

## Goal

The player's report: "the left hand, meaning the lower one, is shown to the right of the right
hand, which is certainly wrong." It is. The keyboard draws every note at its pitch and gets that
right; the pitches are what is wrong. The step 21 transcription has the left hand echo each
right-hand phrase **at the same pitches**, both staves in treble clef, so in bar 7 the left
hand's C5 lights up above and to the right of bar 6's right-hand B4, and the echo in bars 3-4
lands on exactly the keys the right hand just left. The notation is not different in Poland: the
lower staff is the left hand everywhere, and it plays below the right.

## Confirmed decision — one octave down, in bass clef

Asked what they meant, the owner answered "check how this should be done for Silent Night for
now; if this is not enough, I may generate it again". Beginner two-hand arrangements of Silent
Night in C major put the right hand on the melody around middle C and above, and the left hand in
**bass clef, below it** (for example Hello Simply's and KidsPlayMusic's easy versions, and Sheet
Music Plus's "easy piano in C major"). For an arrangement whose left hand echoes the melody rather
than accompanying it, the standard shape is the same phrase an octave down.

So every `<note>` with `<staff>2</staff>` has its `<octave>` lowered by one, and
`<clef number="2">` becomes `<sign>F</sign><line>4</line>`. The rhythms and bars stay the same,
and so does every fingering except the left hand's in bars 19-22 (next section): an octave shift
keeps every interval, so bars 3-8's left-hand fingering stays right. Bars 3-4 become G3 A3 G3 / E3,
bar 7 becomes C4 C4, the closing bars 19-22 become C3 / G3 E3 / G3 F3 D3 / C3, and bar 19's
dyad becomes C5 over C3. The left hand then spans C3-C4 and the right hand E4-F5, so every
left-hand note is below every right-hand note in the piece.

Alternatives weighed:

- **Two octaves down** (bar 3 on G2). Rejected. It is further from the hand's natural place
  beside the right hand than a beginner echo needs, it is not what the arrangements consulted
  do, and C2 is the very left edge of the default "4 octaves" keyboard (`src/config.ts:13`).
- **Keep treble clef for the left hand, with an 8vb marking.** Rejected. It is not how a child's
  sheet music is written, and OSMD's 8vb support would be one more thing to verify for no gain.
- **Rewrite the left hand as chord accompaniment** (C, F and G triads), the most common easy
  arrangement. Rejected. That is composing a different arrangement, and the owner said they
  would supply a new one themselves if this is not enough.

## Confirmed decision — the left hand's fingering in bars 19-22 is corrected

Bars 3-8 carry real left-hand fingering (E 5, G 3, A 2, thumb on C). Bars 19-22 did not: bar 19
put the thumb on C, the lowest note of the phrase, with finger 3 on the G above it in bar 20, and
bar 21 had D on 2 under F on 4. In a left hand the thumb is the highest finger and 2 sits above 4,
so it read as a slip in the source, and the octave move alone would have kept it. Asked, the owner
chose to correct it to a plain left-hand C position (C3 5, D3 4, E3 3, F3 2, G3 1), so the
left-hand `<fingering>` in bars 19-22 reads **5 / 1 3 / 1 2 4 / 5**. The alternatives offered were
leaving the owner's numbers, and waiting for a regenerated arrangement. Bars 3-8's left-hand
fingering and every right-hand fingering stay as they are.

### Provenance

The `<rights>` text and the `<software>` line say the file is a transcription of the owner's ABC.
That stops being exactly true. Add to `<rights>` that the left hand was moved down an octave and
into bass clef, and its fingering in bars 19-22 corrected, at the owner's request, after
transcription, and make `<software>` read
"Transcribed from the owner's ABC notation for piano-tutor, left hand moved down an octave, bars 19-22 left-hand fingering corrected".

## Traps

- **`e2e/hand-colours.spec.ts` is built on the old shape.** Its comment says "the same G4 changes
  colour". After this step no key is played by both hands, so rewrite it around the new fact:
  in bar 1 the marked G4 is `right`, and in bar 3 the marked key is G3 (55), marked `left`, to
  the left of every key the right hand used. Do not keep the old assertion alive by finding
  another shared pitch; there is none.
- **`src/App.test.tsx:29-38` maps pitches to computer keys only from C4 up.** Add the left
  hand's new pitches from `VirtualKeyboardSource`'s bottom row (`BASE_NOTE = 48`, C3 on `KeyZ`),
  or `playPerfectly` will fail with a missing key.
- `e2e/one-hand-practice.spec.ts:24` plays 67 as "m3 b1, the left hand's first note"; that note
  is now 55, and the comment at lines 39-40 ("instead of the left's") goes stale with it.
  `e2e/virtualKeyboard.ts`'s `KEY_FOR_PITCH` has only 64, 67 and 69; add `55: 'b'` (G3).
- `src/score/parseScore.test.ts:52-63`, the bar-19 test, asserts `{ pitch: 60, hand: 'left' }`
  and `finger: 1`, with the comment "C5 over C4"; it becomes `{ pitch: 48, hand: 'left', finger: 5 }`,
  C3. That makes it a named check on the fingering correction too, for bar 19 at least.
  `DECISIONS.md:23` ("a C5 over C4") goes stale with it, and so does the "ten pitches" comment at
  `src/App.test.tsx:25-26`.
- **The parse snapshot changes on purpose.** Regenerate it and check that the diff holds only
  staff-2 pitches, each exactly 12 lower, and the left-hand fingers of bars 19-22.
- **The staff's height is measured, not assumed** (`src/score/StaffView.css`, "~277px engraving",
  and `DECISIONS.md`). Bass clef changes the ledger lines under the lower staff. Measure it again;
  if the 300px pane now cuts the staff off, the `overflowsDownwards` assertion in
  `e2e/staff.spec.ts`'s "the staff draws the piece" fails, and the fix is the height and its entry, not a change to the notes.
- The element snapshots in `e2e/*-snapshots/` should not move: they are all taken in bars 1-4 (`e2e/falling-notes.spec.ts` plays only bars 1-2), where neither pitch nor fingering changes, and the keyboard snapshot marks only m1 b1's right-hand G4. If one moves, stop and
  report it rather than re-blessing it.
- The keyboard presets' comment (`src/config.ts:9-10`) says each range contains "C4-F5"; it is
  now C3-F5, which all three presets still contain. `DECISIONS.md:86` says "this score's C4-F5
  range" and `prompts/README.md`'s step 21 paragraph says "both hands in treble clef"; both
  change with it.

## In scope

The octave and clef change and the bars 19-22 left-hand fingering in the MusicXML, its provenance lines, and the tests, comments,
`DECISIONS.md` and `MANUAL-CHECKS.md` text that name the old pitches.

## Out of scope

- **Any change to the keyboard, the hand colours or the parser.** They are right; this is a data
  fix.
- **Changing the arrangement in any other way** — rhythm, harmony, or fingering beyond bars
  19-22's left hand. That is the owner's to supply, as step 21 was.
- **Any other piece.** Step 22 is still waiting for a second one.

## What this makes harder later

Nothing is one-way. Stored attempts hold counters and a loop range, not pitches
(`src/progress/types.ts`), so history recorded against the old pitches stays valid, but nothing
in a record says which version of the piece it was: the merge date is the only dividing line, and
the `DECISIONS.md` entry should give it. Any recording the owner made on the piano against the old
left hand replays as wrong notes from bar 3; that is expected, not a regression. **If the owner regenerates the arrangement**, it replaces the file wholesale as step 21
did, and this step's new test (below) goes with it if the new left hand crosses the right on
purpose.

## Decisions to record in `DECISIONS.md`

Amend the step 21 entry rather than adding one: it says "C4-F5", "both hands written in treble
clef" and "the left hand echoes it on the same pitches". Say instead that the left hand echoes an
octave lower, in bass clef, moved there by this step because the same-pitch echo put the left hand
to the right of the right on the keyboard, and that this follows how two-hand beginner
arrangements of the piece are written rather than the owner's ABC. Say too that the left hand's
fingering in bars 19-22 was corrected to a left-hand C position, because as written it was
right-hand fingering, and that its "a fingering on every single note" is still true but no longer
all the owner's. Give the merge date as the line between attempts recorded against the old left hand and the new one. In the keyboard-presets entry, "this score's C4-F5 range" becomes C3-F5.

## Gate

- **Layer 1, in `src/score/parseScore.test.ts`. This is the check that fails without the step.**
  Over the file's parsed score (the test file's local `cichaNoc`), the highest left-hand pitch is lower than the lowest right-hand pitch. It
  names the complaint directly, where the snapshot only says "something changed".
- The regenerated snapshot, reviewed as above.
- **Layer 3**, the rewritten `e2e/hand-colours.spec.ts`: G4 marked `right` in bar 1; G3 marked
  `left` in bar 3.
- `npm run ci` green proves the file parses, engraves without being cut off, and plays through on
  the computer keyboard. It does not prove the engraving reads correctly or that the piece sounds
  right at the piano; those are manual.

## Manual

Item 3: bar 19's dyad is now "C5 and C3", and the left-hand echo in bars 3-4 should be marked to
the left of where the right hand played bars 1-2. Item 11: the staves read "treble over bass",
and a sentence saying the file now differs from the owner's ABC in three ways, and why: the left
hand's clef, its octave, and its fingering in bars 19-22 (5 / 1 3 / 1 2 4 / 5). The owner reads
the staff against the ABC with those differences, and says whether the lower echo sounds right and
whether the corrected fingering sits well under the hand.

## Finally

Add the step to the Planned table in `prompts/README.md` (done with this brief); move it to
Shipped when it lands.
