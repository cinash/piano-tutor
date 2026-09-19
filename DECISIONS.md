# Decisions

Non-obvious choices made while building this app, and why.

## `cicha-noc.musicxml` is self-authored, not transcribed from a physical book

The original plan was to transcribe the piece from the player's own sheet music in
MuseScore. At the user's request, this file was written directly instead: a standard
"Silent Night" verse 1 in C major, 6/8, using a strict 5-finger C-position (finger 1 =
C4 through finger 5 = G4, no hand shifts) so the fingering-to-pitch mapping never
changes. If the player's actual book uses different fingerings or a different key, this file
should be replaced with one transcribed from it — nothing downstream depends on the
specific pitches or fingerings chosen here.

## `MidiEvent.time` is source-relative, not wall-clock

Each `MidiSource` picks its own monotonic origin for `time` (`performance.now()`-style
for `WebMidiSource`, fixture-relative for `ReplayMidiSource`). The practice engine only
ever diffs two `time` values against each other (e.g. the chord-roll window), so the
absolute origin never matters — this keeps recorded fixtures portable and avoids ever
comparing a live timestamp against a recorded one.

## Recorded/replayed fixtures are a raw `MidiEvent[]` JSON array

No wrapper object, no metadata. A fixture recorded from the "Start recording" control
downloads as exactly the array `ReplayMidiSource` and the Layer 2 mutators expect, so
turning a recorded bug into a test is a straight drop into `fixtures/` with no
translation step.

## Tempo is out of scope for this milestone; the falling-note view will not animate on a clock

The user descoped the tempo slider for now. Since wait-mode has no time limit and tempo
was its only other consumer, the falling-note view (step 4) will show the upcoming
note(s) and shift the queue only when the engine advances — no `requestAnimationFrame`,
no continuous scroll, no clock dependency. This keeps the view a pure re-render on state
change rather than introducing timing concerns for a feature that isn't being built yet.

## On-screen keyboard width is a player-configurable preset, not derived from the score

Offered a choice between a fixed four octaves, a fixed five and a fixed 88, the player
asked for the width to be configurable — so `src/config.ts`'s `KEYBOARD_PRESETS` is a
list of three fixed ranges (4 octaves, 5 octaves, 88 keys) picked via a `<select>`,
rather than a single hardcoded range, free numeric low/high inputs, or a value computed
from the score. The fixed list is what lets every preset contain the score by
construction; free input couldn't offer that guarantee.

It is still not derived from `cicha-noc.musicxml`. There is one score in the app,
imported by `App.tsx` at compile time with no way to load another, so a
`keyboardRangeForScore()` would be branches that can never run — that would become the
right answer only once a second score exists. Each preset is chosen wide enough to
contain this score's C3-G4 range regardless, which is what the Layer 2 gate checks.

## `VirtualKeyboardSource` key mapping

Two overlapping octave rows of the QWERTY layout, keyed by `KeyboardEvent.code` so it's
unaffected by locale or Shift state: `Z S X D C V G B H N J M ,` for one octave from the
base note (default C3), and `Q 2 W 3 E R 5 T 6 Y 7 U I` for the next octave up,
overlapping by one note at the top of the first row / bottom of the second — the
convention used by several DAWs' "typing keyboard" instruments. This comfortably covers
the piece's C3-G4 range with margin on both sides.

## Replay is a dev-only file picker, not a bundled fixture

The in-app "Replay a recorded fixture" control loads any local JSON file via
`<input type="file">` rather than importing a fixture from `fixtures/` at build time.
Two reasons: it avoids a TypeScript `rootDir` conflict (test files and app code live
under `src/`, but `fixtures/` sits at the repo root as the canonical location for
recorded regression fixtures), and it mirrors the real workflow — after recording a bug
at the piano, you already have a JSON file on disk to load back in.

## Score parsing: hand from `<staff>`, not `<voice>`

`parseScore` assigns `Note.hand` from the MusicXML `<staff>` number (1 = right, 2 =
left) rather than `<voice>`. `cicha-noc.musicxml` gives every note an explicit
`<staff>`, and staff is the element MusicXML uses specifically for "which stave does
this print on" in a multi-staff (piano-style) part, which maps directly onto hands. A
missing `<staff>` defaults to right, since a part with only one staff has nothing else
it could mean.

## Score parsing: two different "beat" units, by design

`ScoreEvent.beat` (position within the bar) and `ScoreEvent.startTime` /
`durationBeats` (tempo-independent global position) intentionally use different units:

- `beat` counts pulses of the time signature's own beat unit — in 6/8 that's eighth
  notes, so a bar counts 1 through 6, matching how a musician actually counts the bar.
- `startTime` and `durationBeats` are always in quarter notes, independent of the
  prevailing time signature, using MusicXML's `<divisions>` (which is already defined
  as "divisions per quarter note") as the conversion factor. This keeps them
  comparable across a hypothetical time-signature change, where "one beat" would
  otherwise mean a different duration before and after the change.

## Score parsing: a chord's `durationBeats` is the longest of its notes

`ScoreEvent` has one `durationBeats` for the whole event, but a chord spanning both
hands can combine notes of different length (`cicha-noc.musicxml` m. 1 beat 1: the RH
dotted-quarter melody note against the LH dotted-half chord). The parser takes the
longest note's duration. Both consumers of this field care most about the longest
note: wait-mode (step 3) shouldn't move on before every note in the chord has finished
sounding, and the falling-note view's (step 4) bar height should reflect the fullest
sustain, not the shortest.

## Score parsing: grace notes are parsed but produce no event

MusicXML grace notes have no `<duration>`, so they don't advance the parser's timing
cursor — the note after a grace note keeps the position it would have had anyway. The
parser skips them entirely rather than emitting a zero-duration `ScoreEvent`, since
neither the model nor any consumer in this milestone (wait-mode, the falling-note
view, looping) has a notion of an ornament to wait for or display. `cicha-noc.musicxml`
has none; the synthetic fixture `src/score/fixtures/grace-notes.musicxml` covers this
in tests.

## Score parsing: `<duration>` is trusted directly, dots are not re-derived

A dotted note's sounding length is already fully expressed in its `<duration>` (in
divisions) by the time MusicXML is written; `<type>` and `<dot>` are notation-only
and never consulted. This also sidesteps needing any special-case logic for compound
meters like 6/8.

## Score parsing: `<divisions>` is assumed constant for the whole piece

`Score.divisions` is a single scalar (matching the target model), so the parser reads
whichever `<attributes><divisions>` value it last saw and does not attempt to convert
positions computed under an earlier value if it changes mid-piece. `cicha-noc.musicxml`
never changes it, so this is untested; get it right when a piece that needs it exists.

## Score parsing: a measure's length comes from the time signature, not its contents

`readTiedNotes` advances the piece-wide timeline by the nominal bar length (beats ×
divisions-per-beat) at the end of every measure, rather than by how far the cursor
actually got. This is correct for any complete bar, which is everything
`cicha-noc.musicxml` has, but would silently misplace every later event's `startTime`
against a pickup (anacrusis) or other intentionally incomplete measure. Handle that
when a piece with one exists.

## Score parsing: only the first `<part>` is read

`cicha-noc.musicxml` is a single piano part with two staves (one per hand), which is
how `parseScore` expects both hands to arrive — via `<staff>`, not via separate
`<part>` elements. A MusicXML file that instead splits the hands into two `<part>`s
would silently parse to only one hand's worth of notes. Not a concern for this piece;
worth remembering if a differently-structured file ever replaces it.

## Score parsing: repeats are unimplemented, not merely untested

`cicha-noc.musicxml` has no repeat markings, and the step 2 spec makes repeat-unrolling
optional in that case. Rather than add speculative handling nothing exercises, the
parser reads `<measure>` elements strictly in document order; a piece using `<repeat>`
would currently play through once, unrolled or not. Add real support (and settle the
measure-numbering-after-unroll question this file was told to record) when a piece
that needs it exists.

## A disconnected Web MIDI device silently drops the app back to "Not connected"

If the currently connected input disappears from the enumerated device list (unplugged),
the app stops the source and clears held notes rather than trying to keep the UI in a
"waiting to reconnect" state. Reconnecting is just picking the device again once it
reappears in the dropdown.

## Practice engine: the roll window and note-off debounce don't gate `advance()`, but early-note grace does

Step 3's spec lists `chordRollWindowMs`, `earlyNoteGraceMs` and `noteOffDebounceMs` as
tolerances that live in one config object (`ENGINE_TIMING`) so they can be tuned later.
The first and third don't change `advance()`'s control flow, and that's deliberate
rather than an oversight: the spec is also explicit that waiting has no time limit,
ever, and that a chord's already-satisfied notes stay satisfied indefinitely while the
rest is missing — so there is no room for a "too spread out" rejection without
contradicting that. Concretely: a design where a chord's already-played notes expire
after `chordRollWindowMs` (so a slow arpeggiated chord attempt would need re-playing)
would make the "missing note" Layer 2 case fail, since that case expects the notes that
did sound to stay satisfied no matter how long the last one takes to arrive.
`noteOffDebounceMs` would need a real timer to do anything, which a pure, timer-free
`advance()` can't run. Both values are exported anyway, for a later step's UI
(rolled-chord feedback, held-note debounce on the falling-note view) to read from the
same place `advance()`'s tests were written against.

`earlyNoteGraceMs` is different: `advance()` credits a note played for the _next_ event
while the current one is still open, provided it arrives within `earlyNoteGraceMs` of
the current event's completion — tracked via `EngineState.pendingEarlyNotes`, a
pitch→clock map consumed (and cleared) the moment the engine advances. Nothing here
contradicts the invariants above, since it never un-satisfies an already-satisfied
note — it only decides whether an _extra_ note gets credited toward what comes next, or
is discarded and has to be replayed once the engine catches up to it.

## Falling-note view: "wrong note" is tracked event-by-event, not re-derived from `heldNotes`

`EngineState.status` is only `'waiting'` or `'complete'` — the practice engine (step 3)
deliberately has no third "wrong" status, since a wrong note doesn't change what the
engine is waiting for. The falling-note view still needs to show a wrong note visibly
not advancing.

The first version of this derived "wrong" on every render, straight from
`EngineState.heldNotes`: a held pitch neither in the current event's expected pitches
nor the next event's. That's wrong — `heldNotes` accumulates across events, and a note
correctly played for an earlier event routinely stays held into a later one (e.g.
`cicha-noc.musicxml` m. 1's LH dotted-half chord, sustained under three RH melody
events). Re-testing it against a _later_ current/next pair flagged it wrong the moment
the engine advanced past it, so playing the piece exactly as written painted most of
every bar red.

`src/practice/practiceView.ts` fixes this by tracking wrongness as a fact decided once,
at the moment a `noteOn` arrives — mirroring `advance()`'s own current-vs-next check
(`src/engine/advance.ts`) against the state _before_ that call — and cleared on that
same pitch's `noteOff`, independent of how far the engine moves on afterwards.
`FallingNotes` just renders the resulting `hasWrongNote` boolean; it no longer computes
wrongness itself. `src/practice/practiceView.test.ts` pins both the genuine-wrong-note
case and the sustained-correct-note regression this replaced; `src/App.test.tsx`'s
version of the same regression test carries, in its own comment, the one fact that
makes it discriminating rather than accidentally passing either way (m2 b1 repeats
m1 b1's exact chord).

## `window.__practiceState` only carries what a Layer 3 test needs

The snapshot (`src/practice/practiceState.ts`) is `nextEventIndex`, `heldNotes` and the
attempt's two counters — the only fields the Playwright suite asserts on. Add a field
here when a test actually needs to assert on it, rather than mirroring the practice
state wholesale. It is built from the whole `PracticeViewState` rather than from
`EngineState` alone, because the counters live on the view state (step 6) while the
first two fields live on the engine. The e2e project (`tsconfig.node.json`) doesn't
include `src`, so `e2e/window.d.ts` duplicates the shape rather than importing it — the
two type surfaces are independent by the existing project split, and DOM lib was added
to that config so `page.evaluate()`
callbacks (which run as browser-side code) can reference `window` at all.

## Loop selection: setting a loop doesn't jump playback, only changes where it wraps

`LoopPicker` (step 5) lets the user pick a start/end measure, but `setLoop()`
(`src/engine/advance.ts`) only stores the range on `EngineState.loop` — it never moves
`nextEventIndex`. Picking a loop range before playing anything therefore doesn't skip
straight to `startMeasure`; the piece still plays forward from wherever it already was,
and only wraps back to the loop's first event once `advance()` would otherwise move past
`endMeasure` (`nextIndexAfter`, also in `advance.ts`). This matches the step 5 spec
literally (it only describes the wraparound trigger, not a jump-on-select), and it means
a loop selected mid-piece still lets the notes before `startMeasure` play once, normally,
before the range starts repeating — rather than requiring a special "reset to start"
transition alongside the wrap one. `nextIndexAfter` also wraps rather than completing
when the linear next event would run past the end of the piece entirely, so a loop whose
`endMeasure` is the piece's last measure loops forever instead of finishing.

The wrap needs no separate reset: `completeCurrentEvent` already rebuilds
`satisfiedNoteIds` from `pendingEarlyNotes` for whichever index comes next, so the loop's
first event starts from a clean slate the same way any other event does. The main
`advance()`'s own early-note lookahead (crediting a note played for "whatever comes next"
while the current event is still open) is deliberately left reading the _linear_ next
event rather than the loop-aware one `nextIndexAfter` computes — it's asking a different
question ("is this pitch plausibly what the player meant next", not "where does the
cursor actually go"), and the two known edges this leaves at a loop boundary are a real
but narrow tradeoff rather than an oversight:

- Anticipating the event just past the loop (within `earlyNoteGraceMs`) can auto-complete
  the loop's own first event, if the two happen to share a pitch — true for
  `cicha-noc.musicxml`'s m2 b1, which repeats m1 b1's chord, so anticipating m2 while
  about to wrap a 1–1 loop credits the loop's first event (m1 b1) rather than making it
  wait; nothing past that one event is affected.
- The mirror case: anticipating the loop's own restart note while still finishing the
  loop's last event is _not_ granted the early-note grace anywhere else in the piece gets
  (the lookahead's "next" is the linear one, past the loop, not the wrap target), so it's
  flagged as a wrong note in the falling-note view even though it's exactly what's coming.

Both are consequences of one lookahead intentionally not being loop-aware, not two
separate bugs — fixing one by wiring in `nextIndexAfter` would need a real decision about
what "anticipating" should mean at a boundary the piece can cross repeatedly, not a
mechanical swap, so it's left as a known edge case rather than guessed at.

## `VirtualKeyboardSource` ignores note keys typed into the loop's number inputs

`VirtualKeyboardSource` listens for `keydown` on `window`, which still fires while
`LoopPicker`'s measure inputs have keyboard focus, so a key that's also a note (a digit,
or `e`) would otherwise both edit the field and play a note. `isTypingTarget` guards
`handleKeyDown` for exactly `type="number"` inputs — not every `<input>` (a checkbox
doesn't consume typed characters, so guarding it too would have silently killed the
virtual keyboard the moment the "Loop" checkbox was clicked). The guard only suppresses
the note; it doesn't call `preventDefault()`, so the keystroke still reaches the field
normally — `LoopPicker`'s clamp (below) is what keeps that edit from ever landing on
something unrecoverable, so there's no need to also fight the browser over whether the
character gets typed. `handleKeyUp` keeps no such guard — releasing whatever's actually
held must never depend on where focus happens to be, or a key could get stuck in
`heldNotes`.

## `LoopPicker`'s measure inputs clamp to `[1, measureCount]`

The HTML `min`/`max` attributes only constrain the spinner buttons, not typed input, so
without an explicit clamp a stray edit could set a `startMeasure` with no matching
`ScoreEvent` — `nextIndexAfter`'s `findIndex` would return `-1`, and the engine would
latch an unrecoverable `status: 'complete'`, `nextEventIndex: -1` with no way back short
of a reload. `handleStartChange`/`handleEndChange` clamp before calling `onChange`, so
every value the engine ever sees is valid for the current score — valid meaning
`measureCount` itself has an event at or after it, true for every measure of
`cicha-noc.musicxml` but not guaranteed for a piece ending in rests; revisit if one
replaces it. One rough edge the clamp doesn't smooth over: it runs on every keystroke, so
typing a two-digit end measure can clamp the start measure down through an intermediate
one-digit value and leave it there (e.g. start 4, end 4, typing "10" into end leaves
start at 1, not 4) — a real but minor UX rough edge in the mutual-clamp design, not a
correctness issue, and left as-is rather than adding input-level state to smooth out.

## Restart keeps the loop range; connecting a device drops it

`restartPractice` (`src/practice/practiceView.ts`) composes a fresh view state with the
loop it was given, so pressing Restart while a range is selected plays that same range
again — "play that bit again" is the normal reason to press it, and having to re-enter
the range every time would make the button useless for the case it's most wanted in.
`attach()` and `disconnect()` in `App.tsx` deliberately differ: they call
`createInitialPracticeViewState()` outright, dropping the loop, because connecting or
unplugging a device is a fresh start rather than another go at the same passage.

## An attempt's counters are stored; its accuracy is derived

`AttemptStats` is `notesPlayed` and `wrongNoteCount` and nothing else. Accuracy is
`1 - wrongNoteCount / notesPlayed`, computed where it's displayed rather than stored — a
stored ratio is a second copy of the same fact that can disagree with its inputs. It
carries no timestamp either, for the `MidiEvent.time` reason above. Both counters sit
behind `advancePracticeView`'s existing `status === 'waiting'` guard, so playing on past
the end of the piece can't inflate `notesPlayed`. Each counts per `noteOn`, not per
pitch: pressing the same wrong key twice is two wrong notes out of two played, which is
what keeps the ratio meaningful — unlike `wrongNotes`, which is a set of what's
currently sounding wrong.

## Attempt history lives in `localStorage` and is written through on every change

Progress is kept in the browser under `piano-tutor.attempts.v1` — no server, no API,
with step 8's JSON export/import as the way to keep a durable copy or move it between
machines. Each browser therefore keeps its own record, which is fine for one player on
one piano. `App` holds the list as state with the open attempt first and persists the
whole array whenever it changes; the key is a serialisation of that state rather than a
second source of truth.

The wall clock lives in `App`'s effect rather than in `advancePracticeView`, which is
deliberately clock-free (see the `MidiEvent.time` entry above). That effect rewrites the
open record on every change to the practice view instead of waiting for an end-of-attempt
moment, because there is no reliable hook for one: closing the tab, unplugging the piano
and pressing Restart all leave the record already written, so no `beforeunload` handler
is needed. It recognises the boundary by `notesPlayed` returning to 0 — Restart,
`attach()` and `disconnect()` all zero the counters, so that one condition catches every
reset path without touching any of their call sites — and it matches the open record by
`startedAt` rather than by position, since step 8's merge can put an imported record at
the head. An attempt with no notes is never written: this is a history of practice, not
of page loads.

`loadAttempts` reads anything that isn't a stored `AttemptRecord[]` — absent key,
malformed JSON, or a well-formed value of the wrong shape — as an empty history rather
than throwing, because a corrupted key must not brick the app on load.
`isAttemptRecordArray` is the one definition of that shape, which step 8 reuses for
imported files.

## A record keeps the loop range in effect at its last write

Changing the loop mid-attempt leaves the attempt running, and the record simply picks up
whichever range was set when it was last written — the effect watches the whole practice
view, so a loop change alone is such a write. The alternative — treating a loop change as
a restart — would silently discard what had been played up to that point.

## `reachedEnd` is false for every looped attempt

`nextIndexAfter` wraps rather than completing (see the loop-selection entry above), so
playing a range never reaches `status: 'complete'` and such a record's `reachedEnd`
column reads "no". The column means something only for whole-piece attempts. The one row
that can read both a range and "yes" is a piece completed first and given a loop
afterwards without a Restart: `setLoop` preserves `status`, and the open record is
rewritten with the range then in effect, per the last-write rule above. Both are the
existing loop behaviour surfacing in a new place, not a bug introduced here.

## Exported progress is a bare `AttemptRecord[]`, and importing merges rather than replaces

The download is the same array `localStorage` holds, with no wrapper object and no version
field — the convention the recorded fixtures above already follow, and the reason
`isAttemptRecordArray` validates both a stored key and an imported file. Import adds the
records the history doesn't already hold, matched on `startedAt`, leaves the ones it does
alone, and re-sorts newest first so an imported record can't land out of the order
`AttemptHistory` promises. Merging is what makes carrying a file between the host Chrome and
the tailnet deploy non-destructive: neither side loses what the other never saw, and
importing the same file twice changes nothing.
