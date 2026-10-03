# Step 30 — The owner's own music, with its fingering

The owner's request: "create me a prompt to upload own music with fingering in musicxml format". Today every piece the child can
play is a build-time import in `src/score/pieces.ts`, and a new one reaches the child only by a commit. This brief lets the owner's
own arrangement reach the child, uploaded in the browser, with the fingering the owner wrote carried to the keyboard and checked by
the notation rules below.

**Owner answers.** Route: browser upload. Notation the app does not follow: refused. Notes outside C3 to G5: accepted with a warning.
A note with no finger: refused. Rhythm that Timed mode cannot keep time through (6/8, 2/2, 3/8, 9/8, 12/8, sixteenths, triplets,
32nds, time-signature changes): accepted, marked as working only in Wait mode, and Timed is not offered for that piece. Later steps
may support more.

**Simplification (the owner's):** an upload cannot replace a piece and cannot remove one. A file whose title matches an existing upload
or a bundled piece is refused. A correction is uploaded under a new title and is a new piece with its own history. Storage only shrinks
by clearing the site's data, and the owner accepted that. Replacing and removing uploads are future features, not part of this step.

**No open owner decisions.** The brief is ready for an implementer once the owner has confirmed it (see the end).

## What "with fingering" means

The fingering is what the owner put in the file: `<notations><technical><fingering>` on each `<note>`, which `parseScore` already
reads (`readFinger`, `src/score/parseScore.ts`). The app fingers nothing, and this step adds no fingering algorithm. The Beyer scripts
are not reused: they finger a scan of a book, and a file the owner has already fingered needs none of them.

## Files

Expected to touch:

- `src/score/uploads.ts` (new): storage, the list of uploads, the start-up check, the validator entry point.
- `src/score/pieceRules.ts` (new): the rules extracted from `pieces.test.ts`.
- `src/score/pieces.ts`: builds the merged list (bundled first, then uploads); `pieceTitle` reads the uploads list for an upload and the
  bundled `score.title` otherwise; `Piece` gains an optional `title` for uploads.
- `src/score/pieceStore.ts`: `loadPiece` searches the merged list, so a remembered upload is found.
- `src/App.tsx`: the upload input beside "Import progress", the dropdown group and its wait-only label, the Timed control's state for a
  wait-only piece, the alert line, the range warning, and the call that loads the uploads before the initial piece is read
  (`useState(loadPiece)`).
- `src/progress/types.ts`: a one-line comment change, "the piece's id in PIECES", which becomes untrue. No logic changes in `src/progress/`.
- `src/score/pieces.test.ts` (imports `pieceRules`), `src/App.test.tsx`, `src/score/uploads.test.ts`, `src/score/fixtures/uploads/`.
- `e2e/uploads.spec.ts`, and `playwright.config.ts`: the spec goes into the `built` project's `testMatch`, and the `chromium` project's
  `testIgnore` names it too, so it does not run twice.
- `MANUAL-CHECKS.md` (item 11), and `DECISIONS.md`.

No new dependency.

Branch `step-30-own-music`, off `main`, in **two commits**, each passing `npm run ci` and each reviewed on its own:

1. the validator and its rules (`pieceRules.ts`, `uploads.ts` with its checks, the fixtures, `pieces.test.ts` importing the rules);
2. the upload, storage and offer (the input, the dropdown group, the start-up check, quota error, range warning, wait-only label).

**Format.** Uncompressed MusicXML only. The check is on the content, not the extension: a file whose first bytes are the zip signature
`PK` is refused with "compressed .mxl is not supported yet"; anything else is read as XML. The `accept` attribute on the input only
filters the picker. Refusing `.mxl` is because it is not needed yet, not because it needs a dependency: Chrome's
`DecompressionStream('deflate-raw')` plus a reader for one zip entry would do it without one, if the owner's exports arrive compressed.

**Where the control sits.** Beside the "Import progress" control (`src/App.tsx`, around line 738), the owner-facing file action that
already sits below the practice row. A single "Add a piece (MusicXML)" input (`data-testid="upload-piece-input"`), a plain
`<input type="file">` with `multiple` off. It is not placed in the second toolbar row: that row is the child's, and the element snapshots
are taken while it is connected (`src/App.tsx`, the Speed comment). Its refusal messages appear in the existing `role="alert"` line above
the staff (`src/App.tsx:665`). The alert line also carries MIDI and import errors. A refusal stays until the next pick or the next
successful upload clears it. Whether the native input becomes a small button over a hidden input (about 490 px, `DECISIONS.md`) is
carried to the next batch.

**Re-picking the same file.** Chrome fires no `change` event when the same file is picked again. The input clears its value after each
pick, as `handleImportFile` does (`src/App.tsx`, around line 501) and `DevicePicker` does (`src/devices/DevicePicker.tsx`, around line 37).
Without that reset, a retry after a refusal does nothing. The unit and e2e layers cannot tell a reset from its absence (`fireEvent` and
`setInputFiles` both dispatch `change` unconditionally), so this is checked by hand (see Manual).

**After an upload.** A successful upload selects the new piece through the same path as a dropdown change (`handlePieceChange`, refactored
to take an id and look it up in the merged list). A running attempt ends, the demo stops and the loop is dropped, and the alert line is
cleared. A refused upload leaves the running attempt, the selection, the uploads and the storage exactly as they were, and shows the message.

**The dropdown.** Bundled pieces first, in their order; then `<optgroup label="Yours">` holding the uploads in upload order. The group is
omitted when empty. An option's label is `piece.title ?? score.title`, so a file-name fallback title shows. A wait-only upload's label
ends with " (Wait mode only)".

**Wait-only pieces.** While a wait-only piece is selected, the Timed option is disabled, the mode is Wait, and a line says so:
`data-testid="wait-only-note"`, "Timed mode cannot keep time through this piece yet; it plays in Wait mode." Selecting the piece sets Wait
mode. The implementer checks what a remembered Timed choice does on reload, and makes the wait-only piece keep Wait, since the mode is
defined in step 29.

**The range warning.** Shown only for an upload: bundled pieces are already in range, as `pieces.test.ts` checks. It is a line of its own,
`data-testid="range-warning"`, placed directly above the staff and below the second toolbar row, so the row's width is unchanged. It is
derived from the score on each render, so it appears again after a reload.

## Validation

`pieceRules.ts` holds the rules the bundled pieces meet in `src/score/pieces.test.ts`, and both the test and the validator import it: the
timed check and the range constants (48 to 79, the computer keyboard's C3 to G5). The range constants are exported from there, since
`VirtualKeyboardSource` keeps its own map private.

`uploads.ts` does not import `pieces.ts`. The caller passes in the bundled titles, so the module graph has no cycle: `pieces.ts` imports
`uploads.ts` (for the uploads and for `pieceTitle`), and never the other way. Storage is read by an exported `loadUploads()` that `App`
calls before its initial piece is read, never at module top level.

Checks run in this order, stopping at the first failure. Each gives one message naming the problem and, where it has one, its measure.

0. **Format.** Not a zip (see Format above).
1. **Size.** At most 1 MB for the file (`file.size`, bytes, checked before parsing), and at most 2 MB for all stored records together (the
   UTF-8 byte length of each stored XML, summed). The largest bundled piece is 50 KB (`beyer_op101_no09.musicxml`).
2. **Well-formed and titled.** Parses as XML; `parseScore` succeeds; at least one note. A title: `<work-title>`, or if it is absent or empty,
   the file name without its extension, stored in the record, since the file name is not kept and the start-up check cannot recompute it.
   The title is trimmed, and compared case-insensitively against every bundled title and every stored upload's title. A match is refused:
   "a piece with this name is already built in", or "a piece with this name is already uploaded; give the file a different title."
3. **Notation the app does not follow**, detected by the validator walking the DOM itself, since `parseScore` does not expose these facts.
   All refused:
   - a pickup, or any short bar: every measure, per staff, must fill its time signature (the furthest point reached after `<backup>` and
     `<forward>`, not a sum across staves). A measure that does not is refused, naming it;
   - a second `<part>` (count `score-partwise > part`);
   - a single staff: no `<note>` with `<staff>2`, rests included. A piece with a bass staff that only rests is therefore accepted, as the
     bundled pieces that are one-handed are (`DECISIONS.md`, the Peters entry);
   - a `<repeat>` element, refused naming its bar, so the owner writes it out as step 21 decided (`DECISIONS.md`: a player taking the repeat
     would be marked wrong from that bar to the end). Sixteen of the 22 Beyer pieces offered today contain a `<repeat>` and are played through
     once (`step22.md`, Repeats; `DECISIONS.md`, the repeat entry). So uploads are held to a stricter rule than the bundled pieces on repeats,
     on purpose;
   - a jump or a coda that breaks the order of play, refused naming its bar: `<sound>` with `dacapo`, `dalsegno`, `fine` or `tocoda` in its
     attributes, `<segno>`, or `<coda>`. The parser reads bars in document order, so these are refused for the same reason as a repeat;
   - a `<divisions>` value that changes after the first measure;
   - a `<key>` element after the first measure.
4. **A finger on every note.** A note is fingered when its `<fingering>` is a whole number from 1 to 5, which is the range `FINGER_COLORS`
   covers. Anything else (`0`, `6`, `3-4`, `a`) counts as unfingered. The check reads the parsed score, as the bundled rule in
   `pieces.test.ts` already does, so a tie's continuation is not a note of its own and grace notes and rests are not checked. Refused,
   naming the first unfingered measure.
5. **Pitches outside C3 to G5 are accepted with a warning.** Not a failure: the check does not stop at it. The warning's text: "Some notes
   are outside the computer keyboard's range (C3–G5); the piano plays them." If any note is also outside the on-screen keyboard's default
   preset (C2 to B5), a second line says: "Some notes are also outside the on-screen keyboard's default range (C2–B5)." Both compare with the
   default preset, not with whatever the on-screen keyboard is set to.
6. **Wait-only marking, not a refusal.** The timed rule from the second `it.each` in `pieces.test.ts`, moved to `pieceRules.ts`: one time
   signature at a quarter note, every event inside its own bar, consecutive events at least half a beat apart. A file that fails it is
   accepted and marked wait-only. The rule is derived from the score, not stored, so it is the same on every load. It covers 6/8, 2/2, 3/8,
   9/8, 12/8, sixteenths, triplets, 32nds and time-signature changes. A pickup is not caught here (`readTiedNotes` advances by the nominal bar
   length, so events land inside their bar by construction), which is why check 3 detects it directly.

## Storage

- One `localStorage` key, `piano-tutor.uploaded-pieces.v1`, holding an array of `{ id, title, xml }`. The raw XML is kept, not a parsed
  `Score`, so a later parser change re-parses it rather than freezing the old reading.
- **The start-up check.** `loadUploads()` re-reads each record and confirms what playing needs: it parses, `parseScore` succeeds, and it has
  at least one note. A record that fails is **dropped**, and a `console.warn` names it. The owner's source file is the copy that matters, and
  it can be uploaded again, so keeping an unplayable copy would only take up quota. Checks 1 to 6 are not run again at start-up, so a later
  rule change, or a bundled piece that later takes the same title, never removes a file that the upload checks accepted.
- **Bad data.** A stored value that is not valid JSON, or not an array of records, is treated as empty and warned about, as `loadAttempts`
  does. The next successful upload overwrites it.
- **Quota.** A quota error on the upload's own `setItem` is shown in the alert line: "Could not save this piece; browser storage is full."
  The piece is not added and is not offered for the session.
- **Nothing is removed or replaced in this step.** Records stay in storage until the site's data is cleared, which also deletes the history.
  Removing and replacing uploads are future features.
- `App` holds the uploads in state and writes them through to the module at the point of change (not in an effect), so the Piece column never
  shows a bare id for a render. `pieceTitle` keeps its signature. An id nothing resolves shows bare.

## Identity

- An upload's id is `upload-` plus a slug of its title, computed once at upload and stored in the record. The slug: Unicode-decompose, drop
  combining marks, map `ł`/`Ł` to `l`, lowercase, replace each run of other non-alphanumerics with `-`, trim `-`; an empty result becomes
  `piece`. The slug is then unique among every stored record's id: a clash gets `-2`, `-3`.
- **Why a title slug and not a random id.** A random id would differ between two copies of the same file, so one piece on two copies would
  have two histories. A slug of the title agrees across copies when each copy's first upload of the piece had the same title. The `-2`
  suffixes depend on the order each copy saw them, so they can differ between copies.
- **A correction is a new piece.** The owner uploads the corrected file under a new title. It gets its own id and its own history, and the
  earlier upload stays in the list. The same title is refused, so a correction must have a new title.
- **A bundled title collides.** A corrected Cicha Noc cannot be uploaded under its own title; it must be retitled and starts a new history.
  Uploads never replace bundled pieces, and no upload takes a bundled id.

## The traps

- **The staff remounts when the piece changes.** `App` already keys `StaffView` by `piece.id` (`src/App.tsx`, around line 668), so no change
  is needed. An upload's id is never reused for another file, so a key by id is enough.
- **Uploaded XML is untrusted.** It is parsed with `DOMParser`, which fetches no external entities, and it is never injected as HTML. The
  Content-Security-Policy added in `bdc40f7` (`vite.config.ts`) applies to the built app only.
- **An unfingered note is shown but not taught.** The app draws it as a blank numeral with no colour (`src/practice/FallingNotes.tsx`), and
  hand positions skip it (`src/keyboard/handPosition.ts`). That is how it behaves, not a reason to accept one: the owner left No. 38 out
  "until the 33 of its 88 notes that carry no finger have one" (`DECISIONS.md`).
- **The e2e gate cannot read the staff's title.** `StaffView` sets `drawCredits: false`, and the OSMD stub in `src/testSetup.ts` draws nothing
  in jsdom. The selected option's label can be read; the browser checks compare staff width and staffline count, as `e2e/choose-piece.spec.ts`
  does.
- **Development-only state.** `window.__practiceState` exists only in development (`src/App.tsx`, around line 371), so the `built` project
  asserts on the page, not on that object.

## Out of scope, each with its reason

- **Editing fingering or notes in the app.** The owner fingers the file before uploading it.
- **Compressed `.mxl`**, as above.
- **Replacing or removing uploads.** Future features, as the owner said. Until then a correction is a new piece.
- **Support for Timed mode on wait-only pieces.** Later steps, as the owner said. This step marks them and does not change the Timed mode.
- **Carrying uploads through the history export.** An attempt's `upload-` id reaches another copy as a bare id, which is the rule step 22 set
  for an id nothing offers (`DECISIONS.md`, the Piece column).
- **Sharing uploads across origins.** Each origin keeps its own: `localhost:5173`, the tailnet copy (https, `README.md`) and the planned GitHub
  Pages copy (`bdc40f7`'s message) do not see one another.
- **Guarding the history write.** See the growth note below; a `try`/`catch` there is a separate change.

## What this makes harder later

- **Corrections pile up, and the child sees them.** Each correction is a new entry in "Yours", and the old one stays. "Kotek" and "Kotek
  (poprawione)" sit side by side, so the child can keep practising a fingering that was corrected, until removal exists.
- **A workaround the owner has that the brief does not forbid.** Download progress, clear the site's data, re-upload the files under their
  original titles, then import the progress. The slug ids match again, so history re-attaches. This is correction in place by ritual, and it
  bends the rule that a correction gets its own history. It is not built or supported here.
- **The 2 MB total never shrinks** except by clearing site data, which also deletes history. At about 50 KB each, 2 MB holds roughly 40 pieces;
  a MuseScore export of 128 notes is about 53 KB, so the real count may be nearer 15 to 40.
- **The owner wants the same pieces on every copy.** Uploads are per origin, so each copy is uploaded to separately, or the store moves to a
  file the server serves. That server change is not planned here.
- **The history and the uploads share browser storage.** An attempt record is roughly 150 to 350 bytes (an estimate). At a few dozen attempts a
  day, the history reaches megabytes within a year or two. The history's `setItem` is unguarded (`src/progress/attemptStore.ts`, line 70) and is
  called from an effect in `App` (`src/App.tsx`, around line 422) with no error boundary, so a full store throws there and React unmounts the app
  mid-attempt. The 2 MB cap for uploads brings that day forward and does not prevent it. The trigger for IndexedDB is therefore this growth as
  well as step 28.
- **Bundled pieces load on demand**, as step 28 grows the list toward 109 pieces (`DECISIONS.md`, the explicit list entry). That would end the
  synchronous `PIECES` and `loadPiece` this design relies on. Uploads are read synchronously either way; the growth above is the real trigger to
  revisit `localStorage`.
- **The storage key and record shape** become a persisted format the moment the first file is saved. A later change needs a version bump and a
  reader for the old one.

**Alternatives weighed, and why not now.**

- _IndexedDB:_ separates uploads from the history's quota, but needs an async read at start-up where `PIECES` and `loadPiece` are synchronous
  today, and no store in the app uses it. Moving is a migration; it becomes the better choice when the history growth above arrives.
- _A directory handle (File System Access API):_ edit in the notation program, reload, done. It removes the storage format in one go, but needs
  a permission prompt each session or a persistent grant, works only in Chromium on desktop, and is awkward to test end to end.
- _Session-only upload, nothing saved:_ no storage format, but the file is picked again every session, and the remembered piece and history
  titles are lost on reload. Worse for daily practice.
- _A folder served at runtime by the tailnet deployment:_ works across devices without browser storage or a rebuild, but needs the async loading
  above and does nothing for Pages.
- _Commit the file and add a line to `pieces.ts`:_ zero build cost. It falls short because the owner asked to upload, which means without a
  developer.
- _Refusing rhythm Timed mode cannot keep time through:_ the earlier draft's choice. Dropped: the owner asked for a wait-only mark instead, and a
  refused file would never reach the child.

**Settled by the owner in this step's review:**

- Rhythm that Timed mode cannot keep time through is accepted as wait-only, and Timed is not offered for that piece.
- A stored record that fails the start-up check is dropped with a warning, not kept.
- Removing and replacing uploads are future features.

**Settled by the existing rule, not asked:** a note has a finger when the parsed score says so (`pieces.test.ts`), so a tie's continuation and grace
notes are not counted separately.

Carried to the next batch, not asked now: the control's label and place, once the owner has seen it; whether the native input should become a small
button over a hidden input; and whether the 2 MB total is right, which the owner can judge only with a few real files.

**Precondition, recorded:** the owner's own MusicXML, one file or a few, is wanted for the validator's evidence on the notation questions. Work starts
without it, on the made-up fixtures below. If the owner's file is refused by a check, that is a finding to discuss with the owner, not a blocker for the
build. Whether the file is committed is the owner's choice: committing it publishes it, since the repository is becoming public
(`.claude/prompts/6-publish-to-github.md`). Cicha Noc is committed, so a committed arrangement is acceptable.

## Decisions to record in DECISIONS.md

- The reversal of "pieces are a build-time list" for uploads, beside the step 22 entry.
- The `pieceRules.ts` extraction: the timed check and range constants are one rule for bundled pieces and uploads. Repeats, jumps and range differ on
  purpose, as the lists above say. The timed rule marks a piece wait-only rather than refusing it.
- The `uploaded-pieces.v1` record, why the raw XML is kept, and why records that fail the start-up check are dropped.
- The 1 MB and 2 MB caps, and why the total exists: the history's `setItem` is unguarded.
- The `upload-` slug ids, computed once at upload and stored, and why they are not random: one piece on two copies would otherwise have two histories.
- The owner's simplification: no replace, no removal (both future features), a same-title upload is refused, and a correction is a new piece.

## The gate

- **Validator (data):** `src/score/uploads.test.ts`, against fixtures under `src/score/fixtures/uploads/`.
  - One refusal fixture for each check: a zip (`.mxl`); an oversized file; an unparseable file; a file with no note; a title clash with a bundled piece,
    with different case and surrounding space; a title clash with a stored upload; a pickup; a short bar in the middle of the piece; two parts; a
    single staff; a repeat; a D.C.; a coda; a divisions change; a key change; a finger of 0, of 6, and of `3-4`; no finger.
  - Accepted and marked wait-only: a 2/2 file, a 3/8 file, an eighth-note triplet file, a 6/8 file and a sixteenths file, each fingered and in range.
    Each reports wait-only; none is refused.
  - Accepted fixtures: one with a finger on every note; one with a `.xml` extension (content, not extension, decides); one with a note outside C3 to
    G5, accepted with the warning; one whose bass staff only rests, accepted.
  - Storage, in `src/score/uploads.test.ts`: the slug (`ł` becomes `l`; an empty result becomes `piece`; a clash gets `-2`); the file-name fallback for an
    empty title; the total cap's refusal; a stored record that fails the start-up check is dropped with a warning and the valid records are kept; bad
    JSON under the key is treated as empty; a quota error on the write is reported and the piece is not added.
  - The check that fails if the feature is absent is the missing-finger refusal: a build without the validator accepts that fixture.
- **Labels and history (component):** `src/App.test.tsx` uploads through the real input and checks the "Yours" group, the selection, the alert line on
  a refusal, and the Piece column naming an upload's title, including a file-name fallback title, rather than its id.
- **Wait-only (component):** selecting a wait-only piece disables Timed, sets Wait, and shows the `wait-only-note` line; a bundled piece shows neither.
- **Warning (component):** the `range-warning` line appears above the staff for an upload with an out-of-range note, not for a bundled piece, and again
  after a page reload.
- **Running app (e2e):** `e2e/uploads.spec.ts` runs in the `built` project in `playwright.config.ts`, under the same Content-Security-Policy as
  `e2e/content-security-policy.spec.ts`, and listens for `securitypolicyviolation` events and asserts the list is empty, as that spec does. It uploads a
  fixture, checks the staff's width and staffline count against the piece selected before the upload, practises the first bar on the virtual keyboard
  (asserting on the page, not on `window.__practiceState`), uploads a corrected file under a new title that has a different bar count, checks the staff
  width changes, and reloads to check the choice is remembered. The first bar of each fixture uses only pitches in `KEY_FOR_PITCH`
  (`e2e/virtualKeyboard.ts`: G3, E4, G4, A4), so the virtual keyboard can play it without changing that file.
- **Snapshots.** The `falling-notes` and `note-names` screenshots must pass unchanged. If either fails, the cause is the change to fix, not a re-baseline.

These prove the file is read, validated, stored, drawn and played. They do not prove the owner's file means what the owner's notation program meant by
it; that is the manual check's job.

## Manual

Only the owner's own file and the real piano can settle this. Extend `MANUAL-CHECKS.md` item 11, which already reads the Cicha Noc staff against the
owner's own copy, rather than adding a twelfth: upload one of the owner's files on the origin the child uses (Web MIDI needs a secure one:
`localhost:5173` on the host, or the https tailnet copy; the tailnet copy runs the build last deployed, so it needs a redeploy first). Confirm:

- the staff shows what the notation program showed, and both hands appear;
- the upload control is findable beside "Import progress", and the second toolbar row looks as it did before;
- picking the same refused file a second time shows the refusal again (this checks the input reset, which no automated layer can);
- if the file is in 6/8 or has sixteenths, it is marked wait-only and plays in Wait mode;
- the first bar plays on the piano, each note and finger matching.

If the row wraps badly, the fix is a layout change, not a re-baseline of the committed element screenshots (`DECISIONS.md`, the staff-pane entry: half a
pixel fails screenshots on antialiasing). The container never talks to the piano, so none of the gate above covers it.

## Finally

Add this step to `prompts/README.md` as Planned, and move it to Shipped when it lands.
