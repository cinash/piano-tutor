# Decisions

Non-obvious choices made while building this app, and why.

## `cicha-noc.musicxml` was self-authored, then replaced by the owner's arrangement

The original plan was to transcribe the piece from the player's own sheet music in
MuseScore. At the user's request, this file was written directly instead: a standard
"Silent Night" verse 1 in C major, 6/8, using a strict 5-finger C-position (finger 1 =
C4 through finger 5 = G4, no hand shifts) so the fingering-to-pitch mapping never
changes. If the player's actual book uses different fingerings or a different key, this file
should be replaced with one transcribed from it — nothing downstream depends on the
specific pitches or fingerings chosen here.

Step 21 replaced it. The owner supplied their own arrangement as ABC notation, and
`cicha-noc.musicxml` is now a transcription of that rather than anything this project
composed; its provenance is recorded in the file's own `<rights>`.

It is a different piece of music in every respect the app can see: 3/4 rather than 6/8,
C4-F5 rather than C3-G4, both hands written in treble clef, and a fingering on every
single note. Its shape is a call and response — the right hand plays a phrase and the
left hand echoes it on the same pitches — so the two hands never sound together except
in m. 19, where a C5 over C4 is the only event in the piece carrying more than one note.
There are no chords and no ties anywhere else, and no bar is left silent by both hands,
so the piece has no gap between one event's end and the next one's onset.

Nothing downstream depended on the old pitches, which is what kept the swap to one file,
its parse snapshot, and the test assertions that named particular notes. Entries below
this one that illustrate a decision with m1 b1's chord, a sustained left hand under a
moving melody, or the 6/8 bar are describing the arrangement this one replaced; the
decisions they record are unaffected.

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

Step 17's Listen demo does run on a clock, and that is not the slider coming back. It
plays at one constant, `DEMO_BPM`, tuned by ear and left alone; the clock exists only
while the demo is playing, and practice itself is still untimed and still waits forever.
The constant lives in the demo's own module rather than in `src/config.ts`, which holds
the presets the player can change — a demo constant sitting there would read as a knob
somebody had forgotten to wire up.

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
contain this score's C4-F5 range regardless, which is what the Layer 2 gate checks.

## The keyboard says which key, the falling-note queue says which finger

The highlight on the on-screen keyboard is a second cue beside the queue, not a
replacement for it. The queue keeps answering "which finger, and what is coming" in the
five finger colours, and the keyboard answers the question it never could — which key
that finger goes on, which is what a player who does not already know the piece needs
before they can start at all. Neither cue is redundant, so `FallingNotes` was left
untouched: colour there stays the primary cue and the numeral the secondary one.

`PianoKeyboard` takes the expected `Note[]` rather than a set of pitches, even though it
only reads `pitch` today. `Note` already carries `hand`, so the hand colours planned next
add an attribute and nothing else; a `Set<number>` would have to become a
`Map<number, Hand>` one step later, rewriting the prop, its tests and the `App`-side
construction. `heldNotes` stays a `ReadonlySet<number>` because it comes from MIDI and
has no `Note` behind it.

## A key that is both expected and held renders as held

Playing a key is the more specific fact about it, and it agrees with the queue, whose
finger circle dims once a note is satisfied — so while you hold one note of an expected
chord, that key reads as held and the notes still missing stay marked as expected. The
precedence lives in `PianoKeyboard.tsx`, which picks one of the two class names, rather
than in two equally specific CSS rules whose order decides the outcome: that order is a
coincidence anyone could reverse while tidying the stylesheet, not a decision. Both
`data-` attributes still report the truth independently, which is what the tests assert
against.

## The keyboard is coloured by hand, the queue by finger

Two colour systems share the screen, and each answers a question the other doesn't: the
keyboard says which hand a key belongs to, the queue says which finger plays it. They are
never adjacent — the queue sits above, the keyboard below — so a player reads one at a
time, and step 4's finger colours were left exactly as they were. The queue circles are
not recoloured by hand and carry no L/R marker.

The hand colours are amber for the right hand and teal for the left, in a white and a
black variant each, chosen by the player from a set deliberately clear of everything
already on screen: the five finger colours (violet, orange, green, blue, pink), the
sky blue of a held key, and the red that marks a wrong note in the queue. Two swatches
sit under the keyboard labelling them, because the hand system is the newer of the two
and is the one a cold player would otherwise have to guess at.

Held still wins over both hand colours, for the reason in the entry above. Such a key
keeps reporting its `data-hand` regardless: the attribute tracks the lookup, the colour
tracks what you are doing.

## Key labels are sharps only, and only on the white keys

`noteName` has the MIDI number and nothing else to work from, so every black key it
names is a sharp. That is a limitation rather than a preference: `parseScore.ts` reads
the MusicXML spelling to compute a pitch and then discards it, so by the time a number
reaches the keyboard nothing remains to say whether the composer wrote B♭ or A♯, and in
a flat key the app would print A♯ over the score's B♭. Fixing it means carrying the
spelling through the parser and onto `Note`, which is a step of its own with its own
parser tests, and was not smuggled into this one. It stays latent for now — no black key
is labelled — but it is the first thing to settle for anything that names one.

The labels go on the white keys and nowhere else. A black key is about 27px wide at the
default four-octave preset, which does not hold `C♯4`, and truncating it to `C♯` would
sit an unoctaved label beside octaved ones; a black key's identity is read off its white
neighbours, which is how it is found on the real instrument too. They stay on at every
preset, 88 keys included, where a white key is about 24px — narrower than the black keys
this declined to label. That is deliberate: two characters fit 24px where four do not,
and a player who picks the whole instrument is not asking for a subset of its labels.
There is no width threshold hiding them and no switch turning them off. If they turn out
to be unreadable or to be clutter, that is a real observation, and the answer is the
label's size or orientation rather than its absence.

## `VirtualKeyboardSource` key mapping

Two overlapping octave rows of the QWERTY layout, keyed by `KeyboardEvent.code` so it's
unaffected by locale or Shift state: `Z S X D C V G B H N J M ,` for one octave from the
base note (default C3), and `Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P [` above it, overlapping
by one note at the top of the first row / bottom of the second — the convention used by
several DAWs' "typing keyboard" instruments. The second row ran one octave, to C5, until
step 21: the arrangement that landed then reaches D5 and F5, which fell off the end of
it, so it was continued along the same pattern to F5 and stops there, at the piece's own
top note.

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

Step 21's arrangement is that piece — the owner's ABC repeats its bars 9-12 — and the
answer was still not to implement repeats. The owner chose to have the repeat written
out in the MusicXML instead, so those four bars appear twice and the file is 22 measures
rather than 18. The parser is not the only thing that would have to understand a repeat
sign: the staff would draw one, and the engine, the measure readout and the loop picker
would all carry on straight past it, so a player taking the repeat would be marked wrong
from bar 13 to the end. Writing it out keeps all of them telling the same story, at the
cost of measure numbers after bar 12 not matching the owner's own source.

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

## `nextEventIndex` is allowed past the last event, and `status` is the guard

A completed piece leaves `nextEventIndex` one past the end of `score.events`, so anything
reading the current event must branch on `status === 'complete'` first rather than index
and hope — `formatPosition` (`src/practice/positionReadout.ts`) does, and `notesAt` takes
the same fact as its empty-list case.

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

## Practising one hand filters the score, not the engine

Left/right/both narrows a copy of the `Score` — each event's notes cut to the selected
hand, and events left with nothing dropped — and hands that to the unchanged engine.
The alternative, a `hands` field on `EngineState` and a filter inside `advance()`, would
have to be agreed on by `advance`, `nextIndexAfter`, the early-note grace and
`practiceView`'s wrong-note check, and it has a stall in it: an event belonging entirely
to the other hand leaves `expectedPitches` empty, nothing matches it, and `advance()`
never moves past it. That stall hides, which is what makes it worth writing down —
`completeCurrentEvent` tests `expectedPitches.every(...)`, true of an empty array, so
completing a real event recurses straight past the empty ones after it and mid-piece the
thing looks like it works. Only index 0 — the first event of an attempt, at start or
after Restart — hangs. Dropping the emptied events means that state cannot occur.

Filtering the score also takes the other hand out of the finger queue for free: those
notes are no longer in the events it renders. `measureCount` is deliberately untouched,
so the position readout still counts twenty-two bars when you practise one hand of them.

## Changing hands restarts the attempt

`nextEventIndex` is an index into the event list, and each hand's filtered list is a
different list — holding the number across a change would land on a different note. So
the hand radios call `restartPractice`, the same path the Restart button uses, which
zeroes the counters and therefore closes the open attempt record through the
write-through effect above. There is no second reset path.

## One-hand attempts are recorded indistinguishably from two-hand ones

`AttemptRecord` says nothing about which hand was practised, so the history's accuracy
column now mixes two things it does not label: fourteen left-hand notes at 100% sits
beside forty-five two-hand notes at 100% and reads the same. That is the price of leaving
the `localStorage` schema alone — `isAttemptRecordArray` validates field by field, so a
`hands` field added without tolerating its absence would reject every record already
stored and every file step 8 has exported. Known trade, not a bug; recording the hand is
its own step if the mixing turns out to matter.

## The staff renders from the raw MusicXML, never from `Score`

`Score` is lossy on purpose — rests are dropped, ties are collapsed into one event,
`<type>` and `<dot>` are never consulted, and MusicXML's note spelling is discarded at
parse time, all for reasons the entries above give. Notation cannot be reconstructed from
it. It does not have to be: `src/score/cichaNoc.ts` already imports the file with Vite's
`?raw`, so the renderer's input is a string that was in the bundle before this step, and
that module now exports it alongside the parsed score.

The two are independent representations of the same piece, neither derived from the other:
the XML is what gets drawn, the `Score` is what the engine waits on. This is the entry
that should stop a later refactor from "unifying" them — deriving the staff from `Score`
would mean re-adding everything `parseScore` deliberately throws away, and deriving
`Score` from the staff would put a layout engine underneath the practice engine.

## OpenSheetMusicDisplay rather than VexFlow directly

VexFlow draws noteheads and beams from instructions; it does not read MusicXML. Using it
directly would mean writing a second MusicXML parser — one that keeps everything
`parseScore.ts` discards — and a layout pass on top of it. OSMD is that parser and that
layout pass, over VexFlow. The parser is the expensive half, so it is the half worth
taking off the shelf.

## The staff's bundle cost is recorded, not mitigated

`opensheetmusicdisplay@2.1.3` ships a single prebuilt `build/opensheetmusicdisplay.min.js`
of 1.33 MB as its only entry, with no `module` field, so there is nothing for Vite to
tree-shake. `dist/assets/index-*.js` went from **228,556 bytes (67.5 kB gzipped)** to
**1,539,422 bytes (391 kB gzipped)** — 6.7× — and that is the whole of the app's
JavaScript, since it builds to one chunk.

Nothing was done about it. No lazy boundary, no dynamic `import()`, no second chunk: the
app is served from localhost during practice and from a small k3s deployment otherwise,
so the number buys nothing back today. It is written down here so that whoever decides it
matters is reacting to a measurement rather than a guess.

## The staff is a fixed-height pane, and it sits above the loop picker

Engraved at the window's width the whole piece is some 640 px tall, which would push the
finger queue most of the way down the window — the staff is a third cue beside the queue
and the keyboard, not a replacement, so it is bounded to 320 px and scrolls. The height is
also a whole number on purpose: OSMD's is fractional (639.5 px here), and half a pixel of
it would land the queue and the keyboard on a half-pixel boundary, failing their committed
screenshots on antialiasing alone. It sits above the _loop picker_ rather than directly
above the queue for the same screenshot-sliver reason that already put the position readout
and the hand radios below it — measured, not guessed: between the two, one snapshot failed
by 88 pixels.

`autoResize` is off, so the score is engraved once at the width of the window that loaded
it and does not reflow when the window is resized; the pane's `overflow: auto` keeps it
reachable until a reload. That is the price of owning the lifecycle, and the lifecycle had
to be owned — 2.1.3 attaches a window resize listener it never removes.

## OSMD is stubbed in jsdom, and the staff is proved in a real browser

OSMD measures glyphs through a canvas 2D context to lay a score out, and jsdom has none, so
`render()` throws there — mounting the real thing under Vitest leaves an unhandled rejection
behind every test that renders `<App />`. `src/testSetup.ts` replaces the class with a stub
for every jsdom test, which leaves the component tests able to assert only that the staff's
container is on the page. That thinness is the honest answer rather than a gap: the layer
that can actually see notation is `e2e/staff.spec.ts`, which asserts against a real
Chromium, and whether the notation is _correct_ is item 11 in `MANUAL-CHECKS.md`, because
nothing automated can read music.

## The staff cursor joins the engine to the score on `startTime`

The engine and the staff hold different lists of the same piece. `cicha-noc.musicxml`
contains 66 `<note>` elements; `cichaNocScore.events` contains 44, because `parseScore`
drops rests — 21 of them here, the whole-bar rests that keep the silent hand's voice
filled in — and because `groupIntoEvents` merges notes struck together into one thing to
wait for. So `nextEventIndex` is a number that means nothing to OSMD.

`ScoreEvent.startTime` is quarter-note beats from the start of the piece, and OSMD's cursor
reports the onset it is on as a fraction of a whole note: the same quantity in units that
convert by a factor of four. The cursor is therefore sought by advancing it from the start
until its timestamp reaches the target `startTime`, and every event in the piece has a
distinct one. Counting noteheads or cursor steps instead would have to account for every
rest, tie and stave the parser discarded, and would fail by drifting a note at a time
rather than by breaking — silently, which is the worst way for this to be wrong.

Measured rather than assumed, and measured again when step 21 replaced the arrangement:
walking OSMD's cursor from end to end yields 44 onsets, every event's `startTime` matches
one of them, and OSMD offers none that is not an event. The piece's divisions are 2, so
every `startTime` is a multiple of a half beat and the comparison is between dyadic
fractions — exact in floating point, and no tolerance is needed.

## The cursor is reset and re-scanned on every move, never tracked

OSMD's cursor walks forwards from the start, so seeking backwards — which Restart does, and
which the loop does every time it wraps — means resetting and stepping forward again. That
happens on every target change, unconditionally, rather than keeping a "the cursor is at
index N" variable in step with the engine: knowing that the target had moved backwards would
itself mean remembering where it was, which is the variable this avoids. The piece is 41
events long and the scan costs nothing measurable.

The scan runs with the cursor hidden, because OSMD's `update()` is a no-op on a hidden
cursor: hide, reset, step, then `show()` redraws once at the end rather than once per step.

## The staff always draws the whole piece, both hands, and is marked from the filtered score

Step 14's hand filter drops events from the `Score` the engine runs on, but it does not
touch the survivors' `startTime`. The target handed to `StaffView` is therefore read from
the _filtered_ score — `score.events[nextEventIndex]?.startTime`, the list
`nextEventIndex` actually indexes — while the staff goes on drawing both staves of the
whole piece from the XML. Practising one hand moves the cursor over the notes of that hand
on a score that still shows the other; narrowing what is drawn is a different feature and
nobody asked for it. The same expression covers the end of the piece: `nextEventIndex` is
allowed one past the last event when `status` is `complete`, `undefined` comes back, and
the cursor is hidden, because there is no next note to mark.

## The cursor scrolls its own pane, not the page

A twenty-two-bar piece lays out over several systems and the staff pane is 320 px, so a marker
below the fold marks nothing. OSMD has its own `followCursor`, but it calls
`scrollIntoView({ block: 'center' })`, which centres the cursor in _every_ scrollable
ancestor — including the document, so each note played would drag the whole page about,
and the keyboard is already the element that falls off the bottom. It is left off, and the
seek calls `scrollIntoView({ block: 'nearest' })` on the cursor element itself instead:
that scrolls the pane only as far as it must, and does nothing at all while the marker is
already visible.

## The demo is played by the piano; the app makes no sound of its own

Offered a Web Audio synth, a sampled-piano dependency and the instrument itself, the player
chose the instrument. "Listen" therefore sends note-on and note-off to the piano's MIDI
_output_ port, and the app gains no audio code and no new dependency. What makes that
buildable in a container that never talks to the piano is that it splits in two: the sound
is optional and the highlighting is not.

The port is found by matching the output's name to the input the player already chose, so
they still pick their piano exactly once and the app grows no second dropdown: the
instrument carries the same names on both sides, so selecting `Digital Piano MIDI 1` as an
input names the output too. Failing a match — a host whose two sides are named differently,
or the virtual-keyboard and replay sources, which chose no device at all — the first output
that is not the ALSA loopback, excluded by name against `/^midi through/i`.

Step 17 shipped a different rule, "take the sole output", written on no evidence because
the container has none to give; it is wrong on any Linux desktop and never once fired. The
loopback `Midi Through` is always present, and this instrument exposes two ports of its
own, so the owner's host offers `Midi Through Port-0`, `Digital Piano MIDI 1` and `Digital
Piano MIDI 2` — one output is the exception rather than the rule, and no configuration the
owner could have made would have produced it. The loopback is never chosen because a demo
sent into it is inaudible in exactly the way that bug was; and since both of the
instrument's ports sound, which one is picked does not matter musically, only that the
same one is picked every time.

`findMidiOutput()` answers `MIDIOutput | null`, and every way of having no port is that
same answer — no Web MIDI at all, a permission the player denied (which is what every
Playwright run is), no outputs, or a host whose only output is the loopback. A null plays
the demo silently. It is not an error and does not reach the `role="alert"` line: pressing
Listen with no piano attached is a normal thing to do, and the control is neither hidden
nor disabled for it.

## Listening is not practising

The demo never touches `PracticeViewState` — not `nextEventIndex`, not the wrong-note set,
not the attempt counters — so nothing of it reaches `AttemptHistory`. While it runs,
incoming MIDI is dropped before it reaches `advancePracticeView`: a child playing along
with the demonstration would otherwise have every note recorded as an attempt, and most of
them counted wrong, since the engine is still waiting where they stopped. Stop the demo,
then play.

The flag that drops the input is a ref rather than state because `handleEvent` is
registered once, at `attach()` time, and would otherwise go on reading the value it closed
over — `isRecordingRef` is a ref for the same reason. Whatever restarts practice stops the
demo too: switching hands, connecting a source, unplugging the one that was connected. So
does unmounting, because a demo outliving the screen would leave the piano sounding.

What the demo _does_ drive on screen is divided by a line between "where are we in the
music" and "what should you play". The staff cursor answers the first, so while the demo
plays it follows the demo. The falling-note queue and the keyboard's expected-note
highlight answer the second, and they stay with practice: nothing is asked for during a
demonstration, and a queue racing ahead of a child who is listening would be a second
instruction at the same time. None of this reaches `PracticeViewState` — the demo's
position is component state beside what it is sounding, so Stop restores the practice
cursor by the same path that restores the keyboard.

That position is a second time on `DemoStep`, and the two are different questions:
`atMs` is when the timer fires, in milliseconds from the start of the demo, and
`startTime` is where the step is in the score, in quarter-note beats. The staff cursor
marks beats, so it wants the second and would be wrong at any tempo but one if it were
handed the first.

## Notes are sent as they fall due, never scheduled ahead

Web MIDI's `send(data, timestamp)` would let the whole piece be handed to the browser in
one go, and Chromium gives no way to take it back — there is no `clear()`. A pre-scheduled
piece would keep playing out of the instrument after Stop, and after the cable was
unplugged. A single pending `setTimeout` walks the schedule instead, sending each step as
it arrives; Stop clears that timer and sends note-off for whatever is sounding, because a
note left on is the failure a real piano shows. The highlighting needs a timer of its own
in any case, so pre-scheduling would have meant two schedules to keep in step rather than
one.

Every boundary sends note-off before note-on, including for a pitch that sounds in both
steps. Eleven boundaries in Cicha Noc repeat a pitch, and stopping only the departing ones
would tie the melody's repeated notes into one sustained note on the instrument, while
on-before-off would silence the new note instead of the old one.

## The demo sounds one event at a time

A chord carries a single `durationBeats` for all its notes — the longest of them, by _Score
parsing: a chord's `durationBeats` is the longest of its notes_ — so there is no per-note
duration to play a chord from. So every boundary in the schedule stops every sounding
pitch before it starts the next event's: a pitch lasts until the next event begins, or
until its own written end where that comes first. One event sounds at a time, bar 1's
left-hand chord is released when the melody moves, and the texture is thinner than the
printed music.

That is the same cue practice already gives. Wait-mode asks for one event at a time and the
keyboard marks one event at a time, so a demonstration that sustained the accompaniment
underneath would be showing the player something the rest of the app never asks for. It
also keeps the note-offs honest: a chord left sounding under the next event would put its
note-off in the middle of that event's own copy of the pitch.

While the demo plays, the keyboard's `heldNotes` are the demo's and its `expectedNotes` are
empty. "This key is sounding now" is exactly what `heldNotes` already draws, so no third key
state, no new attribute and no new precedence rule were needed; and during a demonstration
the only marks on the keyboard should be what is sounding, not a chord telling the player to
do something else at the same time.

## Folding the finger queue away is view state in `App.tsx`, and never reaches the engine

The queue is a pure view of `score.events` — step 4 built it that way and nothing since has
given the engine any knowledge that it exists. Folding it is therefore a `useState` in
`App.tsx` beside `keyboardPreset` and `hands`, the other two view-only pieces of state, and
`<FallingNotes>` is simply not rendered while it is folded. It is deliberately not part of
`PracticeViewState`: practice must be identical folded and unfolded, and the failure this
rules out is a folded queue that quietly stopped an attempt being recorded, or that behaved
differently from an unfolded one on a wrong note. `App.test.tsx` pins the first of those:
the opening measure is played through the virtual keyboard twice, folded and unfolded, and
the position readout and the recorded attempt have to match. The wrong-note half is pinned
by the shape of the code rather than by a test — the queue only ever renders a `hasWrongNote`
boolean that `practiceView` has already computed, so not rendering it cannot reach the
computation.

The control sits _below_ the queue rather than above it, joining the position readout and
the hand radios there for the same screenshot-sliver reason those two already record.

## The folded choice is stored as a string, and anything else reads as unfolded

It lives in `localStorage` under `piano-tutor.queue-folded.v1`, alongside the attempt
history, because a player who puts the queue away means it and having it come back on every
refresh is what makes such a control not worth using. `loadQueueFolded()` tests the stored
string for `'true'`, so a missing key, a cleared store, or anything a different version of
this app or a hand-edited store might have left there reads as unfolded — the same "anything
unrecognised means the default" rule `loadAttempts()` follows, reached without a parse step
because a single boolean does not need one.
