# Step 30 — The owner's own music, with its fingering

The owner's request: "create me a prompt to upload own music with fingering in musicxml format". Today
every piece the child can play is a build-time import in `src/score/pieces.ts`, and a new one reaches
the child only by a commit. This brief lets the owner's own arrangement reach the child, with the
fingering the owner wrote carried to the keyboard and checked by the notation rules this brief sets out.

**Nothing here is built until the five owner questions at the end are answered.** The first decides
the route. If the owner picks the folder, the browser-route sections below are replaced, but the
validator (`pieceRules.ts` and the notation checks) still applies: `pieces.test.ts` cannot see a pickup,
a second part, a single staff, a repeat, or a change of divisions or key, and parseScore reads them
silently wrong.

## What "with fingering" means

The fingering is what the owner put in the file: `<notations><technical><fingering>` on each `<note>`,
which `parseScore` already reads (`readFinger`, `src/score/parseScore.ts`). The app fingers nothing,
and this step adds no fingering algorithm. The Beyer scripts are not reused: they finger a scan of a
book, and a file the owner has already fingered needs none of them.

## The browser route

Assumes the first owner question's answer is "upload". The file is read in the browser and kept there.

**Files.** Expected to touch `src/score/pieces.ts`, `src/score/pieceStore.ts`, `src/App.tsx` (the second
toolbar row, the dropdown, the alert line), `src/progress/AttemptHistory.tsx` only if `pieceTitle` changes
its signature (it is not planned to), a new `src/score/uploads.ts` (storage, the merged list, the
validator entry point), `src/score/pieceRules.ts` (the checks extracted from `pieces.test.ts`), and
`e2e/`. No new dependency. Branch `step-30-own-music`, off `main`, in **two commits**, each passing
`npm run ci` and each reviewed on its own: the validator and its rules, then the upload, storage and
offer.

**Format.** Uncompressed MusicXML only. The check is on the content, not the extension: a file whose
first bytes are the zip signature `PK` is refused with "compressed .mxl is not supported yet"; anything
else is read as XML. The `accept` attribute on the input only filters the picker. The reason for refusing
`.mxl` is that it is not needed yet, not that it needs a dependency: Chrome's
`DecompressionStream('deflate-raw')` plus a reader for one zip entry would do it without one, if the
owner's exports arrive compressed.

**Where the control sits.** In the second toolbar row (`src/App.tsx`, the `toolbar` at line 589), directly
after the Piece dropdown, with the visible label "Add a piece (MusicXML)" and
`data-testid="upload-piece-input"`. It is a plain `<input type="file">`, `multiple` off. Its refusal
messages appear in the existing `role="alert"` line above the staff (`src/App.tsx:665`). The row wraps on
a narrow window, and the manual check looks at that. Whether the native input's button and filename text
(about 490 px, `DECISIONS.md`) should be a small button over a hidden input is carried to the next batch.

**Re-picking the same file.** Chrome fires no `change` event when the same file is picked again, which is
exactly the owner's correction flow: re-export under the same name, then upload. The handler clears the
input's value after each pick, as `handleImportFile` does (`src/App.tsx`, around line 501) and
`DevicePicker` does (`src/devices/DevicePicker.tsx`, around line 37).

**After an upload.** The new piece is selected and goes through `handlePieceChange`, so a running attempt
ends, the demo stops and the loop is dropped. A refused upload leaves the running attempt alone and the
current selection in place. A successful upload clears the alert line.

**The dropdown.** Bundled pieces first, in their order; then an `<optgroup label="Yours">` holding the
uploads in upload order. The group is omitted when empty.

## Validation

`pieceRules.ts` holds the rules the bundled pieces meet in `src/score/pieces.test.ts`, and `pieces.test.ts`
and the validator both import it, so the two cannot drift apart. The range constants (48 to 79, the
computer keyboard's C3 to G5) are exported from there, since `VirtualKeyboardSource` keeps its own map
private.

Checks run in this order, stopping at the first failure. Each gives one message naming the problem and,
where it has one, its measure.

0. **Format.** Not a zip (see Format above).
1. **Well-formed.** Parses as XML; `parseScore` succeeds; at least one note; a title. If `<work-title>` is
   absent or empty, the title is the file name without its extension, and it is stored in the record, since
   the file name is not kept and a start-up re-parse cannot recompute it. A title equal to a bundled
   piece's title is refused: "a piece with this name is already built in".
2. **Size.** At most 1 MB for the file, and at most 2 MB for all uploads together (the largest bundled piece
   is 50 KB, `beyer_op101_no09.musicxml`). Refused with a message if it does not fit.
3. **Notation the app does not follow**, detected by the validator walking the DOM itself, since
   `parseScore` does not expose these facts:
   - a pickup: the first `<measure>` carries `implicit="yes"`, or its note durations fall short of the
     time signature;
   - a second `<part>` (count `score-partwise > part`);
   - a single staff (`<staves>` below 2, or no note with `<staff>2`);
   - a `<repeat>` element;
   - a `<divisions>` value that changes after the first measure;
   - a `<key>` element after the first measure.
     Which of these are refused is owner question 3. Sixteen of the 22 Beyer pieces offered today contain a
     `<repeat>`, and the app plays those through once while the staff shows the sign (`step22.md`, the
     out-of-scope bullet on the file picker; `DECISIONS.md`, the repeat entry). For the owner's own arrangement,
     the step 21 decision was to write the repeat out instead (`DECISIONS.md`: a player taking the repeat would
     be marked wrong from that bar to the end). So uploads would be held to a stricter rule than the bundled
     pieces on repeats, on purpose, if the owner answers as recommended.
4. **A finger on every note**, or whatever owner question 4 decides.
5. **Every pitch in C3 to G5**, or whatever owner question 5 decides.
6. **Timed play can keep time through it**: the second `it.each` in `pieces.test.ts`, moved to
   `pieceRules.ts`. One time signature at a quarter note, every event inside its own bar, consecutive events
   at least half a beat apart. The check cannot see a pickup (`readTiedNotes` advances by the nominal bar
   length, so events land inside their bar by construction), which is why check 3 detects it directly.

## Storage

- One `localStorage` key, `piano-tutor.uploaded-pieces.v1`, holding an array of
  `{ id, title, xml, uploadedAt }`. The raw XML is kept, not a parsed `Score`, so a later parser change
  re-parses it rather than freezing the old reading.
- Read once at start-up, beside `PIECES`. A stored file that no longer passes the validator is skipped with
  a `console.warn`. It stays in storage and counts toward the 2 MB total until removed. It never stops the
  app starting.
- A quota error on the upload's own `setItem` is shown in the alert line: "Could not save this piece;
  browser storage is full."
- Replacement subtracts the old record's size from the total before the cap is checked.
- The merged list (bundled, then uploads) lives in `uploads.ts`. `App` holds the uploads in state and writes
  them through to the module, so the module and the screen agree. `pieceTitle` (`src/score/pieces.ts`) keeps
  its signature and reads the module, so the Piece column names an upload's title. An id nothing resolves
  shows bare.
- **Removal and the tombstone are not specified here.** They are designed once owner question 2 is answered,
  because the stored shape and the in-flight behaviour depend on the answer. The brief is revised then.

## Identity

- Ids are `upload-` plus a slug of the title, with `-2`, `-3` on a clash. The prefix keeps an upload from
  colliding with a bundled id. The slug is also the same on every copy of the app that receives the same
  file, so a history exported from one copy and imported into another agrees on which piece it is. The
  `-2` suffix depends on upload order on each copy and weakens that.
- Replacement matches on the title as stored, case- and whitespace-sensitive, and keeps the id.
- **Known trade.** Step 22 wrote bundled ids by hand so a piece could be renamed without forking its history
  (`DECISIONS.md`). An upload's id comes from its title, so renaming it makes a new piece with its own history.
  This is accepted for uploads, since an upload has no file to rename.
- **A bundled title collides.** A corrected Cicha Noc cannot be uploaded under its own title; it must be
  retitled and starts a new history. Letting an upload replace a bundled piece and keep its history is an
  option for owner question 2 and is not built here.

## The traps

- **The staff remounts when the piece changes, including on replacement.** `App` keys `StaffView` by
  `${piece.id}:${piece.uploadedAt}`, so a replacement, which keeps its id, still remounts. This keeps the
  recorded decision in "Changing the piece starts afresh" (`DECISIONS.md`): no cursor effect runs against an
  instance whose container was just emptied. `StaffView` itself does not change. `uploadedAt` is an optional
  field on `Piece`, present only for uploads.
- **Uploaded XML is untrusted.** It is parsed with `DOMParser`, which fetches no external entities, and it is
  never injected as HTML. The Content-Security-Policy added in `bdc40f7` (`vite.config.ts`) must still hold.
  The e2e upload spec runs in the same page under that policy, so a policy violation fails it.
- **An unfingered note is shown but not taught.** The app draws it as a blank numeral with no colour
  (`src/practice/FallingNotes.tsx`), and hand positions skip it (`src/keyboard/handPosition.ts`). That is how
  it behaves, not a reason to accept one: the owner left No. 38 out "until the 33 of its 88 notes that carry
  no finger have one" (`DECISIONS.md`).
- **The e2e gate cannot read the title.** `StaffView` sets `drawCredits: false`, and the OSMD stub in
  `src/testSetup.ts` draws nothing in jsdom. The browser checks compare what `e2e/choose-piece.spec.ts`
  compares: staff width and staffline count.

## Out of scope, each with its reason

- **Removing an upload** until owner question 2 is answered, as above.
- **Editing fingering or notes in the app.** The owner fingers the file before uploading it.
- **Compressed `.mxl`**, as above.
- **Carrying uploads through the history export.** An attempt's `upload-` id reaches another copy as a bare id,
  which is the rule step 22 set for an id nothing offers (`DECISIONS.md`, the Piece column).
- **Sharing uploads across origins.** Each origin keeps its own. `localhost:5173`, the tailnet copy (https,
  `README.md`) and the planned GitHub Pages copy (`bdc40f7`'s message) do not see one another. Owner question 1
  asks which copy the child uses.

## What this makes harder later

- **The owner wants the same pieces on every copy.** Uploads are per origin, so each copy is uploaded to
  separately, or the store moves to a file the server serves. That server change is not planned here.
- **The owner corrects a piece many times.** Replace-by-title keeps the id, so history stays with the piece and
  older attempts read as if played against the corrected version. That is the trade the project already makes
  for corrected bundled files.
- **A dozen pieces.** At about 50 KB each, 2 MB holds roughly 40, so the cap is not the first limit a player
  meets.
- **Bundled pieces load on demand**, as step 28 grows the list toward 109 pieces (`DECISIONS.md`, the explicit
  list entry). That would end the synchronous `PIECES` and `loadPiece` this design relies on, and the
  `localStorage` choice would then be the one to revisit.
- **The storage key and record shape** become a persisted format the moment the first file is saved. A later
  change needs a version bump and a reader for the old one.

**Alternatives weighed, and why not now.**

- _IndexedDB:_ separates uploads from the history's quota, but needs an async read at start-up where `PIECES`
  and `loadPiece` are synchronous today, and no store in the app uses it. The 2 MB cap is the right trade for
  a dozen pieces. It becomes the better choice when bundled pieces load on demand (above), and moving then is a
  migration.
- _A directory handle (File System Access API):_ edit in the notation program, reload, done. It removes the
  storage format, replacement and removal in one go, but needs a permission prompt each session or a
  persistent grant, works only in Chromium on desktop, and is awkward to test end to end.
- _Session-only upload, nothing saved:_ no storage format and no owner question 2, but the file is picked again
  every session, and the remembered piece and history titles are lost on reload. Worse for daily practice.
- _A folder served at runtime by the tailnet deployment:_ works across devices without browser storage or a
  rebuild, but needs the async loading above and does nothing for Pages.
- _Commit the file and add a line to `pieces.ts`:_ zero build cost, and `pieces.test.ts` checks it in full. It
  falls short because the owner asked to upload, which means without a developer, and this is the owner's first
  question.

## Open questions for the owner

Five, ranked by what a wrong answer costs. Each gives the answer this brief would pick and what it costs if
that pick is wrong. Each would change what gets built, so the brief waits for all five.

1. **How do your pieces reach the app, and which copy does the child practise on?** Three copies exist:
   `localhost:5173` on the host, the tailnet copy (https, reached from any tailnet device), and the planned
   GitHub Pages copy (https). An upload reaches any of them, but only on the origin where it was uploaded. A
   `.musicxml` in a gitignored folder, read when the app builds or runs in dev, reaches `localhost:5173` live
   and goes through the same validator, at a fraction of the work. The deployed copy needs a rebuild and
   rollout for each file, and a Pages build reaches it only if the file is committed, which publishes it.
   _Recommend the browser route if the child practises on the tailnet or Pages copy; the folder if on localhost
   only._ Cost if wrong: the browser route for a localhost child is a persisted format and a UI nobody needed;
   the folder for a deployed child means a redeploy for every piece.

2. **Correcting or removing an upload.** Uploading a file with an existing upload's title: replace it and keep
   its id, as corrected bundled files are handled; add it as a separate entry; or refuse. Removal: remove it and
   keep `{id, title}` so history still names it (tombstone); remove it entirely, so history shows a bare id; or no
   removal. _Recommend replace and tombstone._ Cost if wrong: separate entries leave duplicate names for good; no
   removal leaves a mistyped or unwanted piece in the child's list until the site data is cleared, which also
   deletes the history; full removal shows bare ids in history.

3. **Notation the app does not follow.** For a pickup bar, a second part, or a single staff: refuse, or accept.
   For a mid-piece `<divisions>` or key change: refuse, or accept. For a repeat: refuse, naming the bar, so the
   owner writes it out in the notation program as for step 21; or accept it and play it through once, as the
   bundled Beyer pieces are, which leaves the child's repeat unmarked. For a time-signature change, 6/8, or
   sixteenths, which Timed mode cannot keep time through: refuse; or accept for wait-mode only, with Timed off
   for that piece, which needs a state Timed does not have today. _Recommend refuse all of these for now, and
   widen the list when a real file needs it._ Cost if wrong: refusing blocks an ordinary arrangement (the
   owner's Cicha Noc arrangement was 3/4, but step 1's self-written file began in 6/8); accepting a pickup
   silently shifts every later bar's position.

4. **Notes outside C3 to G5.** Accept with a warning, or refuse. The warning is a line under the Piece dropdown
   while the piece is chosen: "Some notes are outside the computer keyboard's range (C3–G5); the piano plays
   them." The on-screen keyboard's default preset is C2 to B5; a piece with notes outside that preset gets a
   second line saying so. _Recommend accept with the warning._ Cost if wrong: refusal hides a piece the piano can
   play; accepting means the child can choose a piece the laptop cannot finish, and the on-screen keyboard shows
   nothing for notes it does not cover.

5. **A note with no finger.** Refuse the file, naming the first unfingered measure, or accept it and show the
   blank numeral the app already draws. _Recommend refuse._ The owner's "with fingering" and the No. 38 precedent
   point the same way. Cost if wrong: refusal makes a half-fingered draft unusable until it is finished;
   acceptance means the child practises notes that were not fingered.

Carried to the next batch, not asked now: the control's label and place in the row, once the owner has seen it;
whether the native file input should become a small button over a hidden input; and whether the 2 MB total is
right, which the owner can judge only with a few real files.

**Precondition, recorded:** the owner's own MusicXML, one file or a few, is wanted before the validator's
fixtures are settled. The arrangements so far came as ABC (`a4f0df7`), so a real MusicXML file is the cheapest
evidence for questions 3 and 4. Whether it is committed is the owner's choice. Cicha Noc is committed, which
shows that a committed arrangement is acceptable. The fixtures below are made up; the owner's file is evidence,
not the test.

## Decisions to record in DECISIONS.md

- The reversal of "pieces are a build-time list", recorded beside the step 22 entry, once question 1 is answered
  for uploads.
- The `pieceRules.ts` extraction: the checks the bundled pieces meet and the uploads meet are one set, except
  where question 3 answers otherwise for repeats.
- The `uploaded-pieces.v1` record, and why the raw XML is kept.
- The 1 MB and 2 MB caps, and why the total exists: the history's `setItem` is unguarded
  (`src/progress/attemptStore.ts`).
- The `upload-` slug ids, and why they are not `crypto.randomUUID` (a secure-context id is not what the slug
  needs), with the known trade of title-keyed identity.
- The staff remount key including `uploadedAt`, reaffirming "Changing the piece starts afresh".

## The gate

- **Validator (data):** `src/score/uploads.test.ts`, against fixtures under `src/score/fixtures/uploads/`.
  - One refusal fixture for each check in the list: a zip (`.mxl`), an unparseable file, a file with no note, a
    title clash with a bundled piece, an oversized file, a pickup, two parts, a single staff, a repeat, a
    divisions change, a key change, a missing finger, a note out of range.
  - Timing fixtures that pass every earlier check and break only check 6: one each for a time-signature change,
    6/8 and sixteenths. Each is fingered, in range and two-staff, so it reaches check 6.
  - Accepted fixtures: one with a finger on every note, one with a `.xml` extension (content, not extension, decides).
  - Also: the file-name fallback for an empty title, a title clash between two uploads (replacement), and the
    total cap's refusal.
  - The check that fails if the feature is absent is the missing-finger refusal: a build without the validator
    accepts that fixture.
- **Start-up and storage (data):** a stored file that no longer validates is skipped with a warning and kept in
  storage, and the app starts with it present.
- **Labels and history (component):** `src/App.test.tsx` uploads through the real input and checks the "Yours"
  group, the selection, the alert line on a refusal, the Piece column naming an upload's title rather than its id,
  and that picking the same file twice in a row triggers a second upload.
- **Warning (component):** the range warning appears under the dropdown for a piece with an out-of-range note.
- **Running app (e2e):** `e2e/uploads.spec.ts` uploads a fixture, checks the staff's width and staffline count
  against the piece that was selected before the upload, practises the first bar on the virtual keyboard, replaces
  the fixture with a corrected one that has a different bar count, checks the staff width changes, and reloads to
  check the choice is remembered. A build that keeps the old staff fails the width check, because the two fixtures
  differ in bar count. The spec runs under the same Content-Security-Policy as `e2e/content-security-policy.spec.ts`.

These prove the file is read, validated, stored, drawn and played. They do not prove the owner's file means what
the owner's notation program meant by it; that is the manual check's job.

## Manual

Only the owner's own file and the real piano can settle this. Extend `MANUAL-CHECKS.md` item 11, which already reads
the staff against the owner's own copy, rather than adding a twelfth: upload one of the owner's files on the origin
the child uses (Web MIDI needs a secure one: `localhost:5173` on the host, or the https tailnet copy), confirm the
staff shows what the notation program showed, confirm both hands appear, check that the second toolbar row wraps
without losing the Piece control, and play the first bar on the piano, confirming each note and finger matches. If
the row wraps badly, the fix is a layout change, not a re-baseline of the committed element screenshots (`DECISIONS.md`,
the screenshot entry: a sub-pixel shift is a finding, not noise). The container never talks to the piano, so none of
the gate above covers it.

## Finally

Add this step to `prompts/README.md` as Planned, and move it to Shipped when it lands.
