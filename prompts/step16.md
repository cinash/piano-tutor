# Step 16 — The staff follows you

Depends on step 15, and on step 3 for the engine state it reads. It copies step 10's prop
shape, so it reads best after it. One branch, `step-16-staff-cursor`, off `main`.

## Goal

Mark where you are in the notation. Step 15 draws the score; until something on it moves, the
player still has to find their own place, which is the job the printed copy was already doing.
This is the step that makes the staff a tutor rather than a picture, and it completes the
flowkey layout: notation with the position marked, above a keyboard showing the next keys.

## The problem this step is actually solving

The engine and the staff hold different lists of the same piece, and nothing lines them up.

`cicha-noc.musicxml` contains 61 note elements. `cichaNocScore.events` contains 41. Bar 1 is
the small version of the whole difficulty: the file has five noteheads — G4, G4, E4 on the
treble staff, C3 and G3 stacked on the bass — while the engine has three events, because
`groupIntoEvents` merges notes struck together into one thing to wait for. Add the file's one
rest and two ties, which `parseScore.ts` drops and collapses, and by the last bar the two lists
have drifted apart by twenty positions.

So `view.engine.nextEventIndex` is a number that means nothing to OSMD, and this step's whole
content is the translation.

## Confirmed decision — join on `startTime`, not on counting positions

`ScoreEvent.startTime` is already "quarter-note beats from piece start, independent of time
signature", and every event in the piece has a distinct one. OSMD's cursor steps through the
score's onsets in time order and reports the timestamp it is on, as a fraction of a whole note —
so the two sides already describe position the same way, in units that convert by a factor of
four. The mapping is: advance the cursor from the start until its timestamp reaches the event's
`startTime`.

Counting noteheads or cursor steps instead would have to account for every rest, tie and stave
the parser discarded, and fails by drifting a note at a time rather than by breaking — which is
why drift is what the manual check below looks for.

**This choice also survives step 14 for free.** The one-hand filter drops events from the score
but leaves the survivors' `startTime` untouched, so a filtered score still points at the right
place on a staff that is still drawing both hands.

## Confirmed decision — reset and re-scan, never track a delta

OSMD's cursor moves forward from the start, so seeking backwards — which Restart does, and
which step 5's loop does every time it wraps — means resetting and stepping forward again. Do
that on every target change, unconditionally, rather than keeping a "cursor is at index N"
variable in sync with the engine: knowing the target had moved backwards would itself mean
remembering where it was, which is the variable this decision exists to avoid. The piece is 41
events long, so re-scanning costs nothing measurable.

## Watch out — the cursor does not exist until the first render

In OSMD 2.1.3 the cursor is initialised inside `render()`, and `render()` itself throws if
`load()` has not resolved. An effect keyed on the target position will therefore fire on first
mount against a cursor that cannot yet be shown or stepped. Gate the seek on the load having
completed and name the guard, rather than finding it as a crash on the first page load.

## In scope

- The seek in `StaffView.tsx`: an effect keyed on the target timestamp that resets the cursor,
  steps it forward and shows it. `App.tsx` passes the target as
  `cichaNocScore.events[view.engine.nextEventIndex]?.startTime` — one expression at one call
  site, so it stays inline rather than becoming a helper. `nextEventIndex` is allowed past the
  last event when `status` is `complete` — the case `step12.md` handles for the position
  readout — and `undefined` is what marks it.
- `StaffView` gains the props it needs to know the target, in the shape step 10 established for
  `PianoKeyboard`: derived state computed in `App.tsx` and passed down, no engine types reaching
  into the view.
- **Keep the cursor in view.** A twelve-bar piece may lay out over several systems, and a marker
  below the fold marks nothing. Scroll it into view when it moves; take the simplest thing that
  works.

## Out of scope

- Colouring individual noteheads, by hand or by finger. The cursor marks position; step 11's
  hand colours live on the keyboard and step 4's finger colours live on the queue, and a third
  colour system on the densest element on screen is how the screen stops being readable.
- Marking wrong notes on the staff. The queue already answers that, and step 10 declined the
  same idea on the keyboard for the same reason.
- Any change to `FallingNotes`, `PianoKeyboard`, the engine, or `parseScore.ts`. If this step
  needs the engine changed, the mapping is being done in the wrong direction — stop and say so.
- Narrowing the drawn score to the loop range. The loop moves the cursor; it does not redraw.

## Decisions to record in `DECISIONS.md`

- The join key is `startTime`, with the 61-versus-41 count as the reason, and the note that
  counting positions drifts silently.
- Reset-and-re-scan over an incremental cursor, and the backwards seeks that force it.
- That the staff always draws the full piece, both hands, regardless of the hand filter.

## Gate

- **No Layer 1/2 case, deliberately.** Once the target is a single optional-chained index
  expression there is nothing pure left to test — this step's logic is the cursor scan, which
  needs a real browser and a laid-out score. Do not manufacture a unit test for the index
  expression, and do not restate what the rest and the tie do to the timeline:
  `parseScore.test.ts` already pins both.
- Layer 3, in a real browser: assert the cursor is visible at the start, play the opening chord
  through the virtual keyboard and assert it has moved, then press Restart and assert it is back
  at the beginning. That pins movement and reset — **not** absolute position. Drift over a run
  of bars is what the manual check catches, because reading a marker against a printed score is
  the one thing no assertion here can do.
- No committed screenshot, for the reason `step15.md` gives.

## Manual

Extend item 11 rather than adding a twelfth: play through a few bars on the real piano and
confirm the marker sits on the note you are actually being asked to play, that it does not drift
over a run of bars, and that it comes back to the start on Restart and at each loop wrap.
