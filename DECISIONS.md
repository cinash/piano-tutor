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

## On-screen keyboard range is hardcoded to C3-G4 for now

`src/config.ts`'s `KEYBOARD_RANGE` matches `cicha-noc.musicxml`'s actual range. Step 2
(score parsing) will derive this from the parsed score instead, per the milestone's
"spanning only the octaves the piece actually uses" requirement — this is a placeholder,
not the final design.

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
