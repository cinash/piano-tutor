# Step 22 — Choosing which piece to play

Makes the one hardcoded score into a list the player picks from. Touches `App.tsx`,
`StaffView.tsx` and `src/score/cichaNoc.ts` — which becomes a different module — plus the
four test files that import the score by name. No new dependency. One branch,
`step-22-choose-the-piece`, off `main`.

## Goal

There is one piece in the app and no way to play another. Add a control that changes it.

## This step needs a second piece, and the owner has to supply it

A control with one option in it is not a feature, and nothing about this step can be seen
to work — or tested past Layer 1 — until a second piece exists. **Do not start until one
has.** The way to get one is the way the current arrangement arrived: the owner writes it
as ABC notation and it is transcribed to MusicXML, as step 21 did for
`cicha-noc.musicxml`.

If the owner would rather not author a second piece, the alternative is for the project to
transcribe one from public-domain material and record its provenance in the file's own
`<rights>`, as `cicha-noc.musicxml` does. That is a decision for them, not for the
implementing agent, and it is worth asking before writing any code: the answer decides
whether this step ships with two pieces of the owner's own or one of theirs and one of
ours.

## Where the pieces live: bundled, not loaded from disk

The pieces are MusicXML files imported at build time, in a list the app knows at compile
time. **A file picker for the player's own MusicXML is out of scope**, and not merely for
size: a file the app did not ship is a file that can fail to parse, can use notation
`parseScore` ignores, can carry no fingerings, and can sit outside every keyboard preset —
four new failure modes on screen in front of a child, each needing its own message. The
in-app replay picker is dev-only for the same reason (see `DECISIONS.md`). Revisit this if
the owner ever wants to add pieces without a rebuild; that is its own step.

## What has to change, and the two traps in it

`src/score/cichaNoc.ts` exports `cichaNocXml` and `cichaNocScore`, and both are imported by
name: the score by `App.tsx:93`, the raw XML by `StaffView.tsx`, and one or both by
`config.test.ts`, `App.test.tsx`, `demo.test.ts` and `parseScore.test.ts`. It becomes a
module exporting a list — an id, a label for the radios, the raw XML and the parsed
`Score` per piece — with the current file as its first entry. `App` holds the selected
piece in state beside `hands` and `keyboardPreset`.

Two things will not fall out of that on their own:

- **`StaffView` loads its XML in an effect with an empty dependency array.** Change the
  piece and the staff keeps drawing the old one. The XML becomes a prop and the effect
  depends on it, which also means the cleanup that empties the container now runs between
  pieces rather than only on unmount — which is what stops the second score being appended
  below the first.

- **`restartPractice` deliberately keeps the loop** (`practiceView.ts:41`, and
  `DECISIONS.md` says why). A loop of bars 18-22 carried onto a twelve-bar piece is a range
  that does not exist. Changing the piece must clear the loop as well as restart, so this
  is not `handleHandsChange` copied.

## In scope

- **A row of radio buttons labelled "Piece"**, beside the keyboard-range picker, one per
  bundled piece and built the same way as `HAND_OPTIONS` (`App.tsx:68`): a focused
  `<select>` jumps option on the first letter typed, and "Cicha Noc" answers to C, which
  `VirtualKeyboardSource` reads as a note. A handful of titles fit on one row.

- **Changing the piece restarts practice and clears the loop**, per the trap above. The
  attempt in flight ends the way `handleHandsChange` ends it — the same call, so a child
  who switches pieces mid-attempt gets the same behaviour they already get switching hands.

- **Changing the piece stops a running demo.** `demoRef.current` holds a schedule built
  from the old score; left running it would play the previous piece over the new one's
  staff.

- **The selection does not persist across a reload.** `keyboardPreset` and `hands` are
  both plain `useState` and reset on reload; the piece behaves the same way. Do not add
  `localStorage` for it — a preference that persists while the two beside it do not is a
  surprise, and if all three should persist that is one step about preferences, not a
  third of one smuggled in here.

- **The keyboard presets stay fixed and the gate widens to cover every piece.**
  `config.test.ts` asserts every pitch of the one score falls inside every preset; it now
  asserts that for every bundled piece. `DECISIONS.md` says a `keyboardRangeForScore()`
  "would become the right answer only once a second score exists" — it does not become the
  right answer here. The presets start at 36 and reach 83 at their narrowest, which holds
  any beginner piece; derive the range only when a real piece falls outside it, and let the
  widened gate be what tells you.

## Out of scope

- **Recording which piece an attempt was of.** The history will mix two pieces' attempts
  under one accuracy column, which is the same trade step 14 made for hands and for the
  same reason: `AttemptRecord` has an optional `loop?` and `isAttemptRecordArray` tolerates
  an absent optional field, so a `piece?: string` would be backward compatible and is not
  hard — it is simply a second thing, with a column, an import path and an export format of
  its own. It is the obvious next step and the mixing will be more annoying than the hands
  version was. Note it in the report; do not build it here.
- **A file picker for the player's own MusicXML**, per the section above.
- **Per-piece anything else** — no per-piece tempo, keyboard width, hand selection or loop
  memory.
- **Tempo, transposition, and a piece's own `DEMO_BPM`.** The demo keeps its one constant.
  A piece that wants a different speed is a reason to reopen the tempo decision in the
  open, which `prompts/README.md` says is a decision to reverse deliberately rather than a
  gap to fill quietly.
- **Anything about the arrangement in `cicha-noc.musicxml` itself.** It is step 21's, it is
  correct, and this step only stops it being the only one.

## Decisions to record in `DECISIONS.md`

- Pieces are bundled at build time rather than loaded from disk, and the four failure modes
  a player-supplied file would put on screen.
- Changing the piece clears the loop as well as restarting, unlike changing hands, because
  a loop range is measured in bars of a particular piece.
- The selection does not persist, and that this matches `keyboardPreset` and `hands`
  rather than being an oversight.
- The piece is chosen from radio buttons rather than a `<select>`, for the same reason as
  the hand radios; the row works only while the library stays small.
- Amend the keyboard-preset entry: it currently argues a fixed list because there is one
  score and a derived range would be dead branches. The first half of that reason is gone;
  the fixed list stays, and the entry should say it is now a judgement that the presets are
  wide enough rather than that nothing else is possible.

## Gate

- **Layer 1 over the piece list**: every bundled piece parses, has at least one event, and
  has a non-empty title; every pitch in every piece falls inside every keyboard preset.
  This is `config.test.ts` widened, and it is the check that would catch a second piece
  that reaches past the narrow preset.
- **Layer 2 over `App`**: selecting the second piece changes the first queued event's id,
  changes the total in the measure readout, and leaves `notesPlayed` at 0 and
  `nextEventIndex` at 0. With a loop set to a range the new piece does not have, selecting
  it leaves no loop rather than an impossible one. With a demo running, selecting a piece
  stops it — assert the button reads "Listen" again and that nothing further is sent to a
  fake output.
- **Layer 3**: with two pieces bundled, choosing the second one changes the title OSMD
  draws on the staff and changes which keys are marked as expected. The staff title is what
  makes this a real end-to-end check rather than a state assertion — `e2e/staff.spec.ts`
  already reads it.
- `npm run ci` green.
- The suite proves the swap, not the music. Whether the second piece is _right_ — its
  notes, its fingerings, its engraving — is the same manual read against the owner's own
  copy that item 11 in `MANUAL-CHECKS.md` asks for, and only they can do it.

## Manual

Extend `MANUAL-CHECKS.md` item 11 rather than adding an item: the same read against the
owner's copy, now for every bundled piece. Add one clause to item 3 as well —
switch pieces mid-practice and confirm the keyboard's expected keys and the queue both
follow, with no note left marked from the piece before.

## Finally

Add step 22 to `prompts/README.md` under its planned section, and move it to Shipped when
it lands.
