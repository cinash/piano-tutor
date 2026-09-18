# Step 1 — Skeleton + MIDI plumbing

Status: **done, merged into `main`** (branch `step-1-midi-plumbing`). This file records what
was actually asked and delivered, for the historical record alongside `DECISIONS.md`.

## Goal

Everything below `MidiSource` and the on-screen keyboard, so the app is usable end-to-end with
no piano attached, and so later steps have real MIDI input to build against instead of a stub.

## In scope

- The three `MidiSource` implementations, all shipped:
  - `WebMidiSource` — real Web MIDI, requesting `{ sysex: false }`.
  - `ReplayMidiSource` — replays a recorded `MidiEvent[]` JSON fixture, either at its recorded
    real-time pace or as fast as possible (`{ realtime: false }`). Both modes are required, not
    optional: Layer 2 (step 3) needs the fast path, Layer 3 and manual review need the real-time
    one.
  - `VirtualKeyboardSource` — maps computer keyboard keys to MIDI notes (two overlapping QWERTY
    rows, keyed by `KeyboardEvent.code`), so the app is fully usable with no hardware.
- Nothing above `MidiSource` may import the Web MIDI API or reference
  `navigator.requestMIDIAccess`.
- A device picker: enumerate Web MIDI inputs, pick one, connect/disconnect, and correctly react
  to a device disappearing mid-session — including the real Web MIDI behavior where an unplugged
  port stays in `access.inputs` with `state: 'disconnected'` rather than vanishing.
- An on-screen keyboard, rendered to scale (white keys equal width, black keys narrower and
  centered on the boundary between their neighbors), reflecting currently-held notes from
  whichever source is active. Range is hardcoded to C3-G4 for now (`src/config.ts`) — step 2
  will derive it from the parsed score instead.
- A dev-only recording control: capture live `MidiEvent`s and download them as JSON, ready to
  drop into `fixtures/` as a new regression fixture.

## Confirmed decisions (binding on later steps too)

- `MidiEvent.time` is milliseconds relative to an arbitrary per-source monotonic origin, never
  wall-clock. The engine (step 3) only ever diffs two `time` values.
- `noteOff` never blocks or gates advancement of anything. Wait-mode (step 3) waits only for the
  correct `noteOn`(s).
- Tempo is out of scope for this milestone. Step 5 is loop-selection only, no tempo slider.
- Because tempo is out, the falling-note view (step 4) does **not** animate on a clock: no
  `requestAnimationFrame`, no continuous scroll. It shows the current/next expected note(s) and
  shifts the queue only when the engine advances. Purely a re-render on state change.
- Recorded/replayed fixtures are a raw `MidiEvent[]` JSON array, no wrapper object.
- `cicha-noc.musicxml` was self-authored (not transcribed from a physical book, per explicit
  request) — see `DECISIONS.md` for the reasoning and its structure (ties across a barline,
  a rest, LH chords, one note with fingering and an equivalent one without, no grace notes).

## Gate

Vitest unit tests for `ReplayMidiSource` and `VirtualKeyboardSource`; a Playwright test showing
on-screen keys highlighting from a replayed fixture (timing margins wide enough to be robust
under load — see the flake fix recorded in the step-1 merge commit). `npm run ci` green.

## Manual (human-only)

See `MANUAL-CHECKS.md` items 1-8: piano detected in the picker, played notes light the right
key, latency feels acceptable, an unplug/replug cycle recovers cleanly, the computer-keyboard
fallback works, and a recording downloads correctly.
