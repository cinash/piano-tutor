# Step 22 — Choosing which piece to play

Makes the one hardcoded score into a dropdown of Cicha Noc and 22 Beyer Op. 101 pieces, and first
packs the controls above the staff into two rows so the choice has somewhere to sit. Adds
`src/App.css`, `src/score/pieces.ts`, `src/score/pieces.test.ts`, `src/score/pieceStore.ts` and
`e2e/choose-piece.spec.ts`; touches `src/App.tsx`, `src/App.test.tsx`,
`src/devices/DevicePicker.tsx`, `src/score/StaffView.tsx`, `src/score/StaffView.test.tsx`,
`src/config.ts`, `src/config.test.ts`, `src/midi/VirtualKeyboardSource.ts` and its test,
`src/progress/types.ts`, `src/progress/attemptStore.ts`, `src/progress/AttemptHistory.tsx` and
their tests, `src/progress/mergeAttempts.test.ts`, `e2e/history.spec.ts` and
`e2e/progress-transfer.spec.ts` (their records gain two fields and their positional cell reads
shift with the new column), `DECISIONS.md`, items 3, 7 and 11 of `MANUAL-CHECKS.md`, one
paragraph of `prompts/step28.md`, and perhaps the committed element screenshots (see the first
commit). No dependency. `src/score/cichaNoc.ts` and `src/score/beyerLibrary.test.ts` stay as they
are. One branch, `step-22-choose-the-piece`, off `main`, in **three commits**, each passing
`npm run ci` and each through the code review on its own.

## Goal

The owner's ask: "the selection of the songs in a simplest possible way for now … some drop down
to the right of the settings", with the songs taken from `beyer_op101_musicxml/`, and "reorganize
slightly the controls at the top so that they don't take so much of a vertical space". A
learning mode that trains the pieces in order comes later and is not part of this step; it is
context for the choices below.

The Beyer import (`DECISIONS.md`, "Beyer Op. 101 Nos. 8-31 come from a LilyPond engraving")
supplies the pieces: 24 files, every one of which parses with `parseScore`, fingers every note,
and stays within G3–G5, inside every keyboard preset.

## Confirmed decisions

The owner settled these before the brief went to an implementer: the first four before it was
written, the next four after the first round of review, and the last two unasked:

1. **Two rows of controls, the piece dropdown last on the second**, chosen over the dropdown
   leading that row and over one wrapping toolbar:

   ```
   piano-tutor  Connected: computer keyboard [Disconnect]  Piano [▾] [Use computer keyboard]  Replay a recorded fixture (dev only) [Choose File]
   [Restart] [Listen]  Speed [100% ▾]   Piece [Cicha Noc ▾]   [Start recording]
   ```

2. **The chosen piece is remembered across a reload.** `hands`, `keyboardPreset` and `demoSpeed`
   keep resetting. With 23 pieces, practising one for a week should not mean picking it again
   after every reload. Rejected: resetting it too, for consistency with the other three.
3. **Each attempt records its piece, and the history shows it** in a "Piece" column — the
   owner's standing rule that history is recorded where the data first exists, since attempts
   recorded without it can never be backfilled. The learn-in-order mode will be its first
   reader. Rejected: leaving it to a later step.
4. **No. 38 is left out** until every note is fingered. It is the PDMX transcription
   `scripts/beyer/test_fingering.py` tests against, and 33 of its 88 notes carry no finger.
5. **Nos. 10 and 11 are left out for now.** The Peters edition step 28 recognises prints other
   pieces under those numbers ("Hänschen klein", "Der Kuckuck"; `DECISIONS.md`), so offering
   this directory's `beyer_op101_no10` and `no11` would put a "No. 10" and "No. 11" — in their
   labels, and in whatever ids they were given — on pieces the child's book may number
   otherwise. They come back once the owner has said which book the child reads from, step 28's
   open question 1. Rejected: renaming them now, and shipping them as they are.
6. **The pieces offered are an explicit list**, not whatever is in the directory. Step 28 will
   keep adding recognised files, and a file there is not necessarily proofread or within the
   narrowest keyboard. A piece reaches the child when someone adds its line. Rejected: globbing
   the directory, which needs no code change per batch and puts every committed file in front of
   the child.
7. **Each attempt also records which hands were practised.** This reverses step 14's decision
   (`DECISIONS.md`, "One-hand attempts are recorded indistinguishably from two-hand ones"), whose
   stated reason was that a new field would reject every stored record and exported file. An
   optional field would not have, as `loop?` shows, and with decision 10 below there is nothing
   left to reject. Without it, a left-hand-only run on a piece reads the same as a full pass to
   the learn-in-order mode. It is recorded, not shown.
8. **The computer keyboard reaches G5**, so the new pieces can be finished from the laptop: 22 of
   the 24 Beyer files reach G5, and `VirtualKeyboardSource` stops at F5. Rejected: a separate
   step, and leaving it.
9. **Each piece carries an explicit id**, written beside it in the list, "so that we can rename
   them later": a file, a title or a label may change without touching history. Rejected: the
   file's base name as the id, which ties stored history to a name someone may want to change.
10. **The history recorded so far is not valid**, in the owner's words, so it is not carried
    forward. `piece` and `hands` are **required** on `AttemptRecord`, not optional, and records
    without them — everything stored or exported before this step — are no longer accepted.
    Rejected: optional fields tolerating old records, which keeps a blank in every reader for
    data the owner has already written off.

## Three commits

Each stands on its own and passes `npm run ci`, so each gets its own review:

1. **Two rows of controls.** Layout only; nothing new, no behaviour changes.
2. **The piece dropdown.** The piece list, `StaffView` taking its XML, the wiring and persistence
   in `App`, the traps below, and the computer keyboard's two keys.
3. **The piece and the hands in the history.** Two required fields on `AttemptRecord`, their
   validation on load and import, and the Piece column.

The second and third reach `main` together in one merge, so no player's history ever holds an
attempt from the second commit without its piece.

## The first commit: two rows

Today seven stacked rows sit above the staff, about 210 px at 1280 px wide: the `<h1>`, the
status line, Disconnect, the Piano select, "Use computer keyboard", the dev-only replay input,
and then recording, Restart, Listen and Speed. After this commit there are two:

- **Row 1** — the heading, then `DevicePicker`'s status, Disconnect, Piano select, "Use computer
  keyboard" and the dev-only replay input. `DevicePicker` returns a fragment instead of a `<div>`,
  so its elements become items of the row; its props and its labels do not change, and it gets
  no stylesheet of its own.
- **Row 2** — Restart, Listen and Speed, then the dev-only recording button, which moves from
  before Restart to the end of the row. The second commit puts Piece between Speed and recording.
  This row shows only while connected, as today.

Both rows are `display: flex; flex-wrap: wrap; align-items: center` with a small gap, from a
`.toolbar` class in a new `src/App.css` imported by `App.tsx`, the way each component imports
its own stylesheet; the rule also zeroes the margins of the `<p>` and `<h1>` inside it. The rows
wrap at a narrow window rather than overflowing; row 1 was measured at about 1243 of the 1264 px
available at 1280 px wide with the labels as they are. The heading stays an `<h1>`, set at about
1.25em. The error `<p role="alert">` moves from between the heading and the device picker to
directly below the two rows. All labels stay as they are.

Rejected: **moving Hands and Keyboard range up into the toolbar.** They are settings too, but
they sit below the queue on purpose (`App.tsx`'s comments, and `DECISIONS.md`): anything inserted
above the queue shifted its committed screenshots by a sub-pixel. The owner asked about the
controls at the top. Also rejected: **the blank band OSMD leaves above and below the staff**,
which is vertical space too, but it belongs to the staff rather than the controls, and trimming it
is a change to `StaffView`'s rendering options with its own screenshots to re-take.

**The trap: the committed element screenshots.** Everything below the controls moves up about
150 px. `e2e/falling-notes.spec.ts` and `e2e/note-names.spec.ts` take element screenshots, and
`DECISIONS.md` ("The staff is a fixed-height pane…") records the queue failing on an edge sliver
when it landed on a half pixel. The remedy it records is to keep heights whole: if the snapshots
fail, give the two rows a whole-pixel height first. Only if that does not bring them back,
look at the diff image, re-take with `--update-snapshots` when the difference is that sliver
alone, and say so in the commit message. A difference inside an element is a real change, and
means the layout touched something it should not have.

## The second commit: the dropdown

### The piece list

`src/score/pieces.ts` exports `PIECES: readonly Piece[]`, where
`Piece = { id: string; xml: string; score: Score }`:

- **Cicha Noc first**, as `{ id: 'cicha-noc', xml: cichaNocXml, score: cichaNocScore }`, reusing
  `src/score/cichaNoc.ts` unchanged, so the four test files that import it keep doing so.
  Rejected: rewriting that module into the list, which touches those files for nothing.
- **Then Beyer Nos. 8, 9 and 12–31**, each a `?raw` import of its file
  (`import beyerNo08Xml from '../../beyer_op101_musicxml/beyer_op101_no08.musicxml?raw'`) and an
  entry in the list, in book order. The list is what the owner decides: a file that is not in it
  is neither offered nor bundled, and the dropdown's order is the list's order. Rejected: an
  `import.meta.glob` over a literal array of paths, shorter, but it returns the files sorted by
  path with no place to write an id beside each.
- **The `id` is written by hand beside each entry**: `cicha-noc`, then `beyer-op101-08`,
  `beyer-op101-09`, `beyer-op101-12` … `beyer-op101-31`. It goes into stored and exported history
  and is the one thing about a piece that never changes (see "What this makes harder later"); the
  file's name and the piece's title are free to. The Beyer ids use the number the piece has in
  this directory, which is Peters' number for every piece offered. Entries are built by a small
  local helper, `piece(id, xml)`, which parses the XML, so each line reads as an id and a file.
- **The label is `score.title`**, the file's `<work-title>`: "Cicha Noc", "Beyer Op. 101 No. 8" …
  No `label` field. Rejected: a label derived from the file name, a second name for the same
  piece.

`src/score/beyerLibrary.test.ts` stays as it is: it checks every file in the directory for
fingering, which is step 28's gate on the library, while `pieces.test.ts` checks what the child
is offered.

Everything is parsed **eagerly, at module load**, as `cichaNocScore` already is: 22 files of
15–50 KB, about 700 KB of XML in the bundle before compression. **Record, with no action taken
this step**, the gzipped main-chunk size from `vite build` before and after, the time
`import('./score/pieces')` takes in Chromium on the dev server (measured with `performance.now()`
around it, once, by hand), and the Vitest suite's duration before and after. Rejected for now: loading
each piece on demand, a dynamic `import()` and a chunk per piece behind a promise, which makes the
piece a loading state in `App` and `StaffView`; 23 pieces do not need it.

### A dropdown that does not steal notes

A focused `<select>` jumps to the option whose label starts with the letter typed, and
`VirtualKeyboardSource` plays letters as notes: every Beyer label starts with B (G3 on the
computer keyboard) and Cicha Noc with C (E3). Pick a piece with the mouse, the select keeps
focus, and the first B or C played switches the piece and restarts the attempt. So the select's
`onKeyDown` **calls `preventDefault()` for every single-character key** (`event.key.length ===
1`). That cancels the type-ahead; the event still reaches the window, where the virtual keyboard
plays the note. Arrow keys, Enter and Tab work as usual, so a keyboard user can still choose.
Rejected: blurring the select after each change, which throws a keyboard user out after one
arrow press — Chromium on Linux changes a closed select's value on an arrow key. Rejected:
radio buttons, which is how Hands avoids the problem, because 23 do not fit on a row. The Speed
and Keyboard range selects have the same exposure for digits and are left as they are.

The dropdown is labelled "Piece" and, unlike the rest of row 2, **is shown before a source is
connected**: choosing what to play before connecting is ordinary, and the staff, queue and
keyboard already draw with nothing connected. So while disconnected it sits alone on row 2 and
moves right when Restart, Listen and Speed appear on connecting. That is the price of the
position the owner chose, and not worth a second layout.

### The traps

- **`StaffView` loads its XML in an effect with an empty dependency array**
  (`src/score/StaffView.tsx:25`), and its `renderedOsmd` state holds the instance the cursor
  effect drives. Change the piece and the staff keeps drawing the old one; fix only the
  dependency, and the cursor effect runs for a moment against an instance whose container was
  just emptied. The XML becomes a prop, and `App` renders `<StaffView key={piece.id} … />`, so a
  new piece is a fresh mount: new container, `renderedOsmd` back to null, one score in the pane.
  The effect lists `xml` as a dependency for the lint rule; the key is what makes the swap clean.
  Rejected: clearing `renderedOsmd` in the effect's cleanup, the same result across two effects.
- **`restartPractice` deliberately keeps the loop** (`src/practice/practiceView.ts:41`;
  `DECISIONS.md` says why). A loop of bars 18–22 carried onto a 16-bar piece is a range that does
  not exist. Changing the piece calls `setView(createInitialPracticeViewState())`, the fresh state
  `attach()` uses: no loop, no attempt in progress, nothing held. The attempt in flight has
  already been written through by the history effect, so it ends exactly as it does when the hand
  changes.
- **A running demo keeps playing the old schedule.** Changing the piece calls `stopDemo()`, as
  `handleHandsChange` does.
- **`scoreRef` follows `score`** through its existing effect once `score` becomes
  `filterScoreByHand(piece.score, hands)`. Nothing else is needed, but it is the line that would
  go stale if `score` were ever memoised on `hands` alone.

`hands`, `keyboardPreset` and `demoSpeed` are kept across a piece change: they are the player's
settings, not the piece's.

### Remembering it

`src/score/pieceStore.ts`, shaped like `src/practice/queueFoldStore.ts`: key
`piano-tutor.piece.v1`, holding the id. `loadPiece()` returns the `Piece` with that id, or
`PIECES[0]` when nothing is stored or the id is no longer offered. `App` holds
`useState<Piece>(loadPiece)` and saves the id in a `useEffect`, as it does the queue fold.
Rejected: remembering hands, range and speed in the same change — the owner was asked only about
the piece.

### The computer keyboard's two keys

`SEMITONE_OFFSET_BY_CODE` gains `Equal: 30` (F♯5) and `BracketRight: 31` (G5), continuing the
DAW layout the map already follows: the black keys on the digit row, the white keys on the
letter row after `[`. Its doc comment and the `DECISIONS.md` entry that gives F5 as "the highest
note cicha-noc.musicxml asks for" say G5 and "the highest note an offered piece asks for".
`pieces.test.ts` checks that every pitch of every offered piece is on the computer keyboard, so a
piece added later that reaches past it fails there rather than on a laptop.

## The third commit: the piece and the hands in the history

`AttemptRecord` gains `piece: string`, the piece's `id`, and `hands: HandSelection`, both
**required**: the owner has said the history recorded so far is not valid, so nothing has to be
tolerated. `isAttemptRecordArray` requires `piece` to be a string and `hands` to be one of
`'both' | 'left' | 'right'`. The consequences, each deliberate and each recorded:

- **History stored before this step reads as no history.** `loadAttempts` already treats
  anything that fails validation as none (`DECISIONS.md`); the first attempt afterwards
  overwrites the old key. The key stays `piano-tutor.attempts.v1`. Rejected: a `v2` key, which
  leaves the old array behind in every browser for nothing to read.
- **A progress file exported before this step is refused on import** with the message a wrong
  file already gets.
- **Every test that builds an `AttemptRecord` literal gains the two fields** —
  `attemptStore.test.ts`, `mergeAttempts.test.ts`, `AttemptHistory.test.tsx`, and the records
  `e2e/history.spec.ts` and `e2e/progress-transfer.spec.ts` seed or import.

The history effect in `App` adds `piece: piece.id` and `hands` to the summary it writes, and both
join its dependencies. Changing either already ends the attempt, so one attempt has one of each.
`mergeAttempts` needs no change: it matches by `startedAt`.

`AttemptHistory` gets a "Piece" column after "When", showing the piece's title, or the bare id
when it is not offered (an import from a copy of the app offering more pieces, or a piece since
withdrawn). The hands are recorded but not shown: the owner asked for them to be recorded, and a
column is the learn-in-order mode's decision.

## Out of scope

- **The learn-in-order mode.** Nothing here orders, locks or suggests pieces; the list is simply
  in book order.
- **Nos. 10, 11 and 38**, per the owner's answers.
- **A file picker for the player's own MusicXML.** Pieces are bundled at build time. A file the
  app did not ship can fail to parse, can use notation `parseScore` ignores, can carry no
  fingerings, and can sit outside every keyboard preset: four new failure modes on screen in
  front of a child, each needing its own message. The replay picker is dev-only for the same
  reason (`DECISIONS.md`).
- **Repeats.** Seventeen of the offered Beyer files carry repeat barlines; the app plays them
  through once, as `DECISIONS.md` records for this import, and the staff shows the signs. Step 28
  writes repeats out in the files it derives. That belongs to the files and the parser, not to
  choosing a piece.
- **Per-piece anything else** — keyboard width, hands, tempo, loop memory. The demo keeps its one
  `DEMO_BPM`; a piece that wants its own tempo reopens the tempo decision, which
  `prompts/README.md` says is reversed deliberately or not at all.
- **Persisting hands, keyboard range or speed.**
- **Filtering or grouping the history by piece.** The column is the whole of the display change.

## What this makes harder later

**The one-way part is the id in stored and exported attempts.** Once a player's history holds
`beyer-op101-12`, that id has to go on meaning the same piece. The rule to record: **an id in
`PIECES` names one piece for good.** Its file may be renamed or replaced by a better version of
the same piece — step 28's Peters-derived No. 12, with its repeats written out — and its title
may change; a different piece takes a new id. This is why the ids are written by hand rather than
derived: a file rename is then a one-line change to an import, not a migration of every player's
history. Leaving Nos. 10 and 11 out means no id has been given to either numbering yet.

The other one-way part is the required fields: they end the history recorded so far, by the
owner's decision. The next change to `AttemptRecord` after this one will not have that licence
once real practice is being recorded, and should be an optional field.

**Played forward:**

- **The learn-in-order mode.** It needs an order, a current piece, and results per piece and per
  hand. `PIECES`' order, the remembered selection and `AttemptRecord`'s `piece` and `hands` are
  exactly those. Nothing here needs undoing.
- **Step 28 grows the library toward 109 pieces.** Each one reaches the dropdown by a line in
  `pieces.ts`, which is where the owner's yes is given. Two gates fire on a piece that is not
  ready: `config.test.ts` for a pitch outside the narrowest preset (step 28 names 8va passages
  and No. 109), and `pieces.test.ts` for one past G5 on the computer keyboard. Each of those is a
  decision to make when it fires, not a failure to route around. At roughly 4 MB of XML, eager
  parsing stops being free, and loading on demand becomes the answer, local to `pieces.ts` plus a
  loading state. A 110-entry `<select>` still works, with `<optgroup>`s by stage a small
  addition then.
- **Step 28 replaces Nos. 8, 9 and 12–31 with Peters-derived files that write their repeats
  out.** The ids stay; the bar counts change. A stored `loop` on an old attempt then names bars
  of the old layout, so old rows' Range reads differently. One sentence in `DECISIONS.md`, not a
  design change.

## Decisions to record in `DECISIONS.md`

- The two rows of controls, and why Hands and Keyboard range stay below the queue.
- The offered pieces are an explicit list in `pieces.ts`, bundled at build time; Nos. 10, 11 and
  38 are out by the owner's choice, with each reason. The measured bundle, start-up and test-time
  cost, and loading on demand as the answer once the library outgrows eager parsing.
- A dropdown, at the owner's request, and why its type-ahead is cancelled rather than its focus
  dropped.
- Changing the piece starts fresh — loop cleared, demo stopped — unlike changing hands.
- The piece is remembered, while hands, range and speed are not: the owner's choice.
- Attempts record the piece's id and the hands, both required, because the owner has declared
  the history so far not valid; older stored history reads as none and older exports are
  refused. The ids are written by hand so files and titles can be renamed, and an id names one
  piece for good. Amend the step 14 entry on one-hand attempts: reversed, and why.
- The computer keyboard reaches G5; amend the entry that stopped it at F5.
- Amend the keyboard-preset entry. It argues a fixed list because "there is one score" and a
  derived range would be dead branches. That half is gone; the fixed list stays as a judgement
  that the presets are wide enough, which `config.test.ts` now checks for every offered piece.
  Update `src/config.ts`'s comment the same way.

## Gate

- **Layer 1, the list** (Vitest, `pieces.test.ts` and `config.test.ts`): `PIECES`' ids are
  exactly `cicha-noc`, `beyer-op101-08`, `-09`, `-12` … `-31`, in that order. Every piece has at
  least one event, a finger on every note, and a non-empty title, and the titles are unique.
  Every pitch of every piece is inside every keyboard preset and within the computer keyboard's
  C3–G5.
- **Layer 2, `App`** (Vitest): choosing Beyer No. 12 changes the readout to "Measure 1 of 8" and
  the first queued event, with `notesPlayed` and `nextEventIndex` at 0. With a loop of bars 18–22
  set on Cicha Noc, choosing No. 12 leaves no loop. With the demo running, choosing a piece turns
  the button back to "Listen" and sends nothing further to the fake output. A second render of
  `App` opens on No. 12, and a stored id that is not offered opens on Cicha Noc. A `keyDown` of
  `c` on the select is default-prevented and one of `ArrowDown` is not (`fireEvent.keyDown`
  returns false when the default was prevented). For the virtual keyboard, `Equal` and
  `BracketRight` emit F♯5 and G5. For the third commit: an attempt played on No. 12 with the left
  hand selected is recorded with `piece: 'beyer-op101-12'` and `hands: 'left'`.
  `isAttemptRecordArray` rejects a record missing either field, `piece: 12` and `hands: 'up'`.
  The history shows an offered id's title and an unknown id as written.
- **Layer 3, the running app** (`e2e/choose-piece.spec.ts`):
  - **The staff redraws.** Read the staff's rendered `svg` width before, choose No. 12 from the
    dropdown, and assert it is much narrower (8 bars against 22) and that the pane holds exactly
    one `svg`. This fails if the staff keeps drawing Cicha Noc, and also if the new score is
    appended below the old. The readout and the keyboard's marked notes follow `App`'s score
    rather than the staff's, so they cannot prove this; assert them as well, for the wiring.
  - **The dropdown does not steal notes.** Focus the select (`selectOption` alone does not focus
    it), choose No. 12, press C, and assert the dropdown still reads No. 12 and that E3 was
    played. Confirm this assertion fails with the `onKeyDown` handler removed; if it does not, it
    is not testing the handler.
  - **Remembered.** After a reload the dropdown still reads No. 12.
  - **The rows, for the first commit.** At 1280 × 720, Disconnect and the Piano select sit on the
    heading's row, and Restart, Listen and Speed share the row below, compared by the vertical
    centres of their bounding boxes. This fails if the rows fall back to stacking.
- `npm run ci` green.
- **What the suite cannot prove:** that the pieces are the right music. Nos. 8, 9 and 12–31 were
  checked against the scan when they were imported (`DECISIONS.md`), but step 28's calibration
  found No. 15's repeat covering bars 1–8 where Peters repeats 9–16, and No. 30 carrying no
  repeat where the book has one. Whether the pieces sit well under a child's hands is the owner's
  call at the piano.

## Manual

Extend item 3: pick a piece other than Cicha Noc with the mouse, then play it on the P-145, and
confirm the marked keys, the hand shading and the queue all follow the new piece, with nothing
left marked from the old one.

Extend item 7: the computer keyboard's `=` and `]` play F♯5 and G5.

Extend item 11: read two Beyer pieces against the book the way Cicha Noc is read — No. 8, whose
hands are both in treble clef with the left hand's G4 on the little finger (`DECISIONS.md` says
why), and No. 20, which carries a repeat the app plays once. Say whether playing it once is
acceptable until step 28's written-out files arrive.

## Finally

- `prompts/step28.md`: in the section on the two files per piece, add that a file reaches the
  child only when a line for it, with a hand-written id, is added to step 22's `pieces.ts`; that
  a derived file of a piece already offered may replace its file, keeping the id; and that a
  different piece — Peters' Nos. 10 and 11 among them — gets a new id.
- `prompts/README.md`: update step 22's row and paragraph, and move it to Shipped when it lands.
