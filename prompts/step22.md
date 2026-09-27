# Step 22 — Choosing which piece to play

Makes the one hardcoded score into a dropdown of Cicha Noc and Beyer Op. 101 Nos. 8–31, and
first packs the controls above the staff into two rows so the choice has somewhere to sit. Adds
`src/App.css`, `src/score/pieces.ts`, `src/score/pieceStore.ts` and `e2e/choose-piece.spec.ts`;
touches `src/App.tsx`, `src/App.test.tsx`, `src/devices/DevicePicker.tsx`,
`src/score/StaffView.tsx`, `src/score/StaffView.test.tsx`, `src/score/beyerLibrary.test.ts`,
`src/config.ts`, `src/config.test.ts`, `src/progress/types.ts`, `src/progress/attemptStore.ts`,
`src/progress/AttemptHistory.tsx` and their tests, `DECISIONS.md` and items 3 and 11 of
`MANUAL-CHECKS.md`, and perhaps the committed element screenshots (see the first commit). No
dependency. `src/score/cichaNoc.ts` stays as it is. One branch, `step-22-choose-the-piece`, off
`main`, in **three commits**, each passing `npm run ci` and each through the code review on its
own.

## Goal

The owner's ask: "the selection of the songs in a simplest possible way for now … some drop down
to the right of the settings", with the songs taken from `beyer_op101_musicxml/`, and "reorganize
slightly the controls at the top so that they don't take so much of a vertical space". A
learning mode that trains the pieces in order is coming later and is not part of this step.
It is context for the choices below.

## What changed since the first draft of this brief

The first draft waited for a second piece and planned radio buttons. Both premises have moved.
The Beyer import (`DECISIONS.md`, "Beyer Op. 101 Nos. 8-31 come from a LilyPond engraving")
put 24 fingered pieces in `beyer_op101_musicxml/`. Every one of them parses with `parseScore`,
fingers every note, and stays within G3–G5, inside every keyboard preset. So the precondition is
met, and a row of 25 radios will not fit.

## Confirmed decisions

Asked before this brief was written, the owner answered:

1. **Two rows of controls, the piece dropdown last on the second**, chosen over the dropdown
   leading that row and over one wrapping toolbar:

   ```
   piano-tutor  Connected: computer keyboard [Disconnect]  Piano [▾] [Use computer keyboard]  Replay (dev) [Choose File]
   [Restart] [Listen]  Speed [100% ▾]   Piece [Cicha Noc ▾]   [Start recording (dev)]
   ```

2. **The chosen piece is remembered across a reload.** The first draft said it should not be,
   to match `hands`, `keyboardPreset` and `demoSpeed`, which all reset. The owner chose to
   remember it. With 25 pieces, practising one of them for a week should not mean picking it
   again after every reload. The other three keep resetting.
3. **Each attempt records its piece, and the history table shows it** in a "Piece" column.
   The first draft left this out as "the obvious next step". The owner's standing rule is to
   record history at the point the data first exists, because attempts recorded without it can
   never be backfilled. The learn-in-order mode is the first thing that will read it.
4. **Beyer No. 38 is left out** until every note is fingered. It is the PDMX transcription
   `scripts/beyer/test_fingering.py` tests against, and 33 of its 88 notes carry no finger.
   Rejected: including it with those gaps, and generating the missing digits into a separate
   copy for the app.

## Three commits

Each one stands on its own and passes `npm run ci`, so each gets its own review:

1. **Two rows of controls.** Layout only. Nothing new, and no behaviour changes.
2. **The piece dropdown.** The piece list, `StaffView` taking its XML, the wiring and
   persistence in `App`, and the traps below.
3. **The piece in the history.** `AttemptRecord.piece`, its validation on import, and the
   column.

The second and third commits reach `main` together in one merge. So no player's history ever
holds attempts from the second commit without a piece.

## The first commit: two rows

Today six stacked rows sit above the staff, about 210 px at 1280 px wide: the `<h1>`, the status
line, Disconnect, the Piano select, "Use computer keyboard", the dev-only replay input, and
then recording, Restart, Listen and Speed. After this commit there are two:

- **Row 1** — the heading, set smaller, then `DevicePicker`'s status, Disconnect, Piano select,
  "Use computer keyboard" and the dev-only replay input. `DevicePicker`'s root and its inner
  `<div>`s stop stacking. This is markup and CSS only, and none of its props change.
- **Row 2** — Restart, Listen and Speed, followed by the dev-only recording button, which moves
  from before Restart to the end of the row. After the second commit, Piece sits between Speed
  and recording. This row shows only while connected, as today, except for Piece (below).

Both rows are `display: flex; flex-wrap: wrap; align-items: center` with a small gap, in a new
`src/App.css` imported by `App.tsx`, as each component already imports its own stylesheet.
They wrap at a narrow window rather than overflowing. The heading stays an `<h1>` for its role
and only gets smaller. The error `<p role="alert">` moves from between the heading and the
device picker to directly below the two rows.

**Rejected: moving Hands and Keyboard range up into the toolbar.** They are settings too, but
they sit below the queue on purpose (`App.tsx`'s comments, and `DECISIONS.md`): anything
inserted above the queue shifted its committed screenshots by a sub-pixel. The owner asked about
the controls at the top. **Also rejected: the blank band OSMD leaves above and below the staff**,
which is vertical space too. It belongs to the staff, not to the controls, and trimming it is a
change to `StaffView`'s rendering options with its own screenshots to re-take.

**The trap: the committed element screenshots.** Everything below the controls moves up about
150 px. `e2e/falling-notes.spec.ts` and `e2e/note-names.spec.ts` take element screenshots, and
`DECISIONS.md` records one of them failing on an edge sliver when the queue moved by a fraction
of a pixel. If they fail, look at the diff image before doing anything else. Re-take them with
`--update-snapshots` only when the difference is that sliver, and say so in the commit message.
A difference inside the element is a real change, and it means the layout touched something it
should not have.

## The second commit: the dropdown

### The piece list

`src/score/pieces.ts` exports `PIECES: readonly Piece[]`, where
`Piece = { id: string; xml: string; score: Score }`:

- **Cicha Noc first**, as `{ id: 'cicha-noc', xml: cichaNocXml, score: cichaNocScore }`, reusing
  `src/score/cichaNoc.ts` unchanged. The first draft rewrote that module into the list, which
  would have touched the four test files that import it by name, and those tests are about Cicha
  Noc in particular. Rejected for that reason.
- **Then the Beyer pieces**, from
  `import.meta.glob<string>('../../beyer_op101_musicxml/*.musicxml', { query: '?raw', import: 'default', eager: true })`
  with No. 38 filtered out, in file-name order, which is Beyer's numbering because the names
  are zero-padded. `src/score/beyerLibrary.test.ts` already has this glob and this exclusion.
  It is rewritten to check the Beyer entries of `PIECES` instead, so the list the app offers
  and the list the fingering gate checks are one list and cannot drift apart. The glob does not
  descend into subdirectories, which matters later: step 28 writes each piece's as-printed
  source to `beyer_op101_musicxml/source/` (`DECISIONS.md`, "A Peters piece is kept twice"). So
  only the files meant for the app are offered, and each new step 28 batch appears in the
  dropdown without a code change.
- **The `id` is the file's base name** — `cicha-noc`, `beyer_op101_no08` … `beyer_op101_no31`.
  It is stored in history and in exported progress files, so it is chosen to be stable (see
  "What this makes harder later").
- **The label is `score.title`**, the file's `<work-title>`: "Cicha Noc", "Beyer Op. 101
  No. 8" … No `label` field is added. Rejected: deriving a label from the file name, which is a
  second name for the same piece. The Layer 1 gate below requires every title to be non-empty
  and unique, which is exactly the check a badly titled future file would fail. No. 38's title
  is "Beyer - No. 38PT", so that check would have fired had it been included.

Everything is parsed **eagerly, at module load**, as `cichaNocScore` already is. That is 24
files of about 35 KB each, some 800 KB of XML in the bundle before compression. **Measure it**:
the gzipped main-chunk size from `vite build` before and after, and the time `pieces.ts` takes
to evaluate in Chromium. Record both in `DECISIONS.md`. Rejected for now: a lazy glob
(`eager: false`), which puts each piece in its own chunk behind a promise. It would make the
piece a loading state in `App` and in `StaffView`, and 24 pieces do not need it. A library of
109 pieces might. That is recorded below as a condition, not built.

### A dropdown, and why it gives up focus

The first draft chose radios because "a focused `<select>` jumps option on the first letter
typed", and `VirtualKeyboardSource` plays letters as notes. That is still true, and it is sharper
here: every Beyer label starts with B (G3 on the computer keyboard) and Cicha Noc with C (E3).
Pick a piece with the mouse, then play, and the first B or C switches the piece and restarts the
attempt. The owner asked for a dropdown, and 25 radios will not fit on a row. So **the select
blurs itself after each change** (`event.currentTarget.blur()`). The next key goes to the page,
where the virtual keyboard listens, and not to the select. This does not protect someone who
tabs into the select on purpose and types letters, and a deliberate keyboard choice is not the
case to guard. The Speed and Keyboard range selects have the same exposure for digits and
are left as they are. This step does not change them.

The dropdown is labelled "Piece" and, unlike the rest of row 2, **is shown before a source is
connected**. Choosing what to play before connecting is ordinary, and the staff, queue and
keyboard already draw with nothing connected.

### The traps

- **`StaffView` loads its XML in an effect with an empty dependency array**
  (`src/score/StaffView.tsx:25`), and its `renderedOsmd` state holds the instance the cursor
  effect drives. Change the piece and the staff keeps drawing the old one. If only the
  dependency is fixed, the cursor effect runs for a moment against an instance whose container
  was just emptied. The XML becomes a prop, and `App` renders `<StaffView key={piece.id} … />`,
  so a new piece is a fresh mount: new container, `renderedOsmd` back to null, one score in the
  pane. The effect lists `xml` as a dependency for the lint rule's sake, and the key is what
  makes the swap clean. Rejected: clearing `renderedOsmd` in the effect's cleanup, which is the
  same result spread across two effects.
- **`restartPractice` deliberately keeps the loop** (`src/practice/practiceView.ts:41`, and
  `DECISIONS.md` says why). A loop over bars 18–22 carried onto a 16-bar piece is a range that
  does not exist. Changing the piece calls `setView(createInitialPracticeViewState())`, the same
  fresh state `attach()` uses: no loop, no attempt in progress, nothing held. It does not copy
  `handleHandsChange`. The attempt in flight has already been written through by the history
  effect, so it ends exactly as it does when the hand changes.
- **A running demo keeps playing the old schedule.** `demoRef.current` was built from the old
  score. Changing the piece calls `stopDemo()`, as `handleHandsChange` does.
- **`scoreRef` follows `score`** through its existing effect, and `score` becomes
  `filterScoreByHand(piece.score, hands)`. Nothing else is needed, but it is the line that
  would go stale if `score` were ever memoised on `hands` alone.

`hands`, `keyboardPreset` and `demoSpeed` are **kept** across a piece change. They are the
player's settings, not the piece's.

### Remembering it

`src/score/pieceStore.ts`, shaped like `src/practice/queueFoldStore.ts`: key
`piano-tutor.piece.v1`, holding the id. `loadPiece()` returns the `Piece` with that id, or
`PIECES[0]` when nothing is stored or the stored id is no longer in the list, for example a file
that was removed. `App` holds `useState<Piece>(loadPiece)`. The id is saved with a `useEffect`
on the piece, as the queue fold is. Rejected: remembering `hands`, range and speed in the same
change. The owner was asked only about the piece, and "all preferences persist" is its own
decision.

## The third commit: the piece in the history

`AttemptRecord` gains `piece?: string`, the piece's `id`. It is optional because every record
written before this step lacks it, and progress files already exported lack it too.
`isAttemptRecordArray` accepts a record whose `piece` is absent or a string and rejects any
other type, as it does for `loop`. The history effect in `App` adds `piece: piece.id` to the
summary it writes, and `piece.id` joins that effect's dependencies. `AttemptHistory` gets a
"Piece" column after "When". It shows the piece's title when the id is in `PIECES`, the bare id
when it is not (an import from a copy of the app with more pieces), and nothing for a record
that has no piece. `mergeAttempts` needs no change, because it matches records by `startedAt`.

## In scope, in short

The two rows. The dropdown, before and after connecting. Cicha Noc and Nos. 8–31, in that
order, opening on Cicha Noc. A fresh start on change: loop cleared, demo stopped. The choice
remembered across reloads. The piece recorded in each attempt and shown in the history.

## Out of scope

- **The learn-in-order mode** (the owner's "later"). Nothing here orders, locks or suggests
  pieces. The list is simply in book order.
- **No. 38**, per the owner's answer, until its fingering is complete.
- **A file picker for the player's own MusicXML.** Pieces are bundled at build time. A file the
  app did not ship can fail to parse, can use notation `parseScore` ignores, can carry no
  fingerings, and can sit outside every keyboard preset: four new failure modes on screen in
  front of a child, each needing its own message. The replay picker is dev-only for the same
  reason (`DECISIONS.md`).
- **Repeats.** Seventeen of Nos. 8–31 carry repeat barlines. The app plays them through once, as
  `DECISIONS.md` already records for this import, and the staff shows the signs. Step 28 writes
  repeats out in the files it derives. A child reading the book will play some bars twice that
  the app asks for once. That belongs to the files and the parser, not to choosing a piece.
- **Extending the computer keyboard past F5.** `VirtualKeyboardSource` stops at F5 (77), and
  most of these pieces reach G5 (79). So a piece cannot be finished from the computer keyboard,
  only from the piano. The piano is what the app is for, and the mapping is its own two-line
  change. It is noted in the report, not made here.
- **Per-piece anything else**: keyboard width, hands, tempo, loop memory. The demo keeps its
  one `DEMO_BPM`. A piece that wants its own tempo reopens the tempo decision, which
  `prompts/README.md` says is reversed deliberately or not at all.
- **Persisting hands, keyboard range or speed.**
- **Filtering or grouping the history by piece.** The column is the whole of the display
  change.

## What this makes harder later

**The one-way part is the piece id in stored and exported attempts.** Once a player's history
holds `beyer_op101_no10`, that name has to go on meaning the same piece. Step 28 will run into
exactly this: Peters prints "Hänschen klein" and "Der Kuckuck" as its Nos. 10 and 11, and this
directory's `beyer_op101_no10` and `no11` hold other pieces (`DECISIONS.md`). If a Peters batch
writes its No. 10 under the existing file name, every attempt already recorded against
`beyer_op101_no10` silently changes piece. The rule to record: **a file name in
`beyer_op101_musicxml/`, once shipped, names one piece for good**. A different piece gets a new
name, and a renamed file needs a migration of stored and imported history. Rejected: an id
independent of the file name, such as a hash or a hand-kept slug table. That is one more thing
to keep in step, and the collision it would avoid is one step 28 has to resolve for the files
anyway.

**Played forward:**

- **The learn-in-order mode.** It needs an order, a "current piece", and per-piece results.
  `PIECES`' order, the remembered selection and `AttemptRecord.piece` are exactly those. Nothing
  here needs undoing.
- **Step 28 grows the library to ~109 pieces.** The glob picks them up with no code change. At
  roughly 4 MB of XML, eager bundling and parsing everything at start-up stops being free.
  Switching to a lazy glob is a local change inside `pieces.ts`, plus a loading state in `App`
  and `StaffView`. A 110-entry `<select>` still works, and sections by stage (`<optgroup>`) are
  a small addition then. Nothing stored changes.
- **Step 28 replaces Nos. 8–31 with Peters-derived files that write their repeats out.** The
  bar counts change under the same ids. A stored `loop` on an old attempt then names bars of the
  old layout. This is the same ambiguity as above, milder: the `Range` column of old rows would
  read differently. Worth a sentence in `DECISIONS.md`, not a design change.

## Decisions to record in `DECISIONS.md`

- The two rows of controls, and why Hands and Keyboard range stay below the queue.
- Pieces are bundled at build time from one glob, with No. 38 excluded by the owner's choice
  until fingered. The bundle and start-up cost as measured, and the lazy glob as the answer
  once the library outgrows it.
- A dropdown, reversing the first draft's radios at the owner's request, and the blur that
  keeps the computer keyboard playable after a pick.
- Changing the piece starts fresh (loop cleared, demo stopped), unlike changing hands.
- The piece is remembered, while hands, range and speed are not: the owner's choice.
- Attempts record the piece's id, which is the file's base name, and a file name once shipped
  names one piece for good.
- Amend the keyboard-preset entry. It argues a fixed list because "there is one score" and a
  derived range would be dead branches. That half is gone. The fixed list stays as a judgement
  that the presets are wide enough, which `config.test.ts` now checks for every piece. Update
  `src/config.ts`'s comment the same way.

## Gate

- **Layer 1, the list** (Vitest): `PIECES`' ids are exactly `cicha-noc` followed by
  `beyer_op101_no08` … `no31` in order, with no `no38`. Every piece has at least one event and a
  non-empty title, and the titles are unique. `beyerLibrary.test.ts` checks every Beyer entry of
  `PIECES` for a finger on every note. `config.test.ts` checks that every pitch of every piece
  falls inside every keyboard preset, which is the check that fails for a future piece that
  reaches past the narrowest preset.
- **Layer 2, `App`** (Vitest): choosing Beyer No. 12 changes the readout to "Measure 1 of 8" and
  the first queued event, with `notesPlayed` and `nextEventIndex` at 0. With a loop of bars
  18–22 set on Cicha Noc, choosing No. 12 leaves no loop. With the demo running, choosing a piece
  turns the button back to "Listen" and sends nothing further to the fake output. A second
  render of `App` opens on No. 12, and a stored id that is not in the list opens on Cicha Noc.
  The select is not the focused element after a change. For the third commit, an attempt played
  on No. 12 is recorded with `piece: 'beyer_op101_no12'`. `isAttemptRecordArray` accepts a
  record without `piece` and rejects `piece: 12`. The history shows a known id's title, an
  unknown id as written, and nothing when the piece is absent.
- **Layer 3, the running app** (`e2e/choose-piece.spec.ts`): choosing No. 12 from the dropdown
  changes the readout, and marks No. 12's first notes on the keyboard. The staff pane then holds
  **exactly one** rendered score, which fails if the old score is left in the pane or the new
  one is appended below it. **Then pressing C on the computer keyboard leaves the dropdown on
  No. 12.** Confirm that this assertion fails with the blur removed, or it is not testing the
  blur. After a reload the dropdown still reads No. 12. For the first commit: at 1280 × 720,
  Disconnect and the Piano select sit on the heading's row, and Restart, Listen and Speed share
  the row below. This is compared by the vertical centres of their bounding boxes, and it fails
  if the rows fall back to stacking.
- `npm run ci` green.
- **What the suite cannot prove:** that the pieces are the right music. The notes and fingering
  of Nos. 8–31 were checked against the scan when they were imported (`DECISIONS.md`). Whether
  they sit well under a child's hands is the owner's call at the piano.

## Manual

Extend item 3: pick a piece other than Cicha Noc with the mouse, then play it on the P-145.
Confirm the marked keys, the hand shading and the queue all follow the new piece, with nothing
left marked from the old one. Reload and confirm the same piece is still chosen.

Extend item 11: read two or three Beyer pieces against the book the way Cicha Noc is read. That
means No. 8, which has both hands in treble clef and the left hand's G4 on the little finger
(`DECISIONS.md` records why), and one piece with a repeat sign, whose repeat the app plays
once. Say whether playing it once is acceptable until step 28's written-out files arrive.

## Finally

Update step 22's row and paragraph in `prompts/README.md`. It no longer waits for a piece. It is
a dropdown, and it records the piece in the history. Move the row to Shipped when it lands.
