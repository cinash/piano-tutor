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

## A disconnected Web MIDI device silently drops the app back to "Not connected"

If the currently connected input disappears from the enumerated device list (unplugged),
the app stops the source and clears held notes rather than trying to keep the UI in a
"waiting to reconnect" state. Reconnecting is just picking the device again once it
reappears in the dropdown.
