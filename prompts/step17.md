# Step 17 — Listen to the piece, with the keys lighting up

Depends on steps 9–11 for the keyboard and its highlight, and on step 14 for the hand
filter. Touches `App.tsx`, `WebMidiSource.ts`, one new module, and lifts
`WebMidiSource.test.ts`'s fake access object into a shared helper. One branch,
`step-17-listen`, off `main`.

## Goal

Let the player hear the piece before playing it, with the on-screen keys lighting up in
time with the sound. The app has never demonstrated the music it waits for, so a child who
does not already know Cicha Noc is being asked to produce notes nobody has shown them. This
came from the players — the owner's children — and it is the highest-priority item on the
plan, ahead of step 18.

## Before you start — confirm the instrument answers

The documentation says the P-145 sounds what it is sent: the P-145 / P-143 MIDI Reference's
implementation chart marks Note ON and Note OFF recognized as well as transmitted. That
reading is second-hand — Yamaha's download host refuses automated fetches — and nothing in
this repository has ever sent the piano a byte, so confirm it on the actual instrument.

**The owner runs this check, not the implementing agent**: the container never talks to the
piano. Ask for it at the start, write the visual half while you wait — it does not depend on
the answer — and do not report the step done before the answer comes back. On the host, with
the piano connected, at `http://localhost:5173` (a secure context, so `requestMIDIAccess`
exists), in the browser console:

```js
const access = await navigator.requestMIDIAccess({ sysex: false });
console.log([...access.inputs.values()].map((p) => p.name));
console.log([...access.outputs.values()].map((p) => p.name));
// Replace the pattern with the piano's own name, from the list just printed.
const out = [...access.outputs.values()].find((p) => /P-?14[35]|piano/i.test(p.name));
await out.open();
out.send([0x90, 60, 96]); // middle C on
setTimeout(() => out.send([0x80, 60, 0]), 1000); // and off
```

Substituting that name matters: a host with a soft synth or an IAC bus has other
destinations, and middle C out of the computer's speakers would answer the wrong question.
The two port lists are the other half of what comes back, and they decide the port rule
below. If the piano stays silent with its MIDI receive channel and MIDI-in enabled, stop and
say so: the answer is then a different sound source (a Web Audio synth in the app), and that
is a decision for the owner to take, not a substitution to make quietly.

## Confirmed decision — the piano makes the sound, the app makes none

The player asked for the playback to go through the MIDI interface of the piano. So this
step sends note-on and note-off to the instrument's MIDI _output_ port and adds no audio of
its own, and no new dependency.

The consequence is what makes the step buildable in the container at all: **the sound is
optional, the highlighting is not.** Port discovery answers `MIDIOutput | null`, and every
way of getting nothing is that same answer: no Web MIDI, a denied permission — which is what
every Playwright run is, since `requestMIDIAccess` exists in the container and rejects with
`NotAllowedError` — an empty `outputs` map, or no port matching. A null output runs the demo
silently and must not reach the `role="alert"` line: pressing Listen without a piano is a
normal thing to do, not an error. Do not hide or disable the control when there is no output.

## Confirmed decision — a Listen button, not an autoplay

Offered a demo that starts by itself as soon as a device is connected, the player chose an
explicit control. It sits beside "Restart", on the same row and under the same
`active.kind !== 'none'` condition, and carries a `data-testid` like every other control in
`App.tsx`. While the demo runs the same button reads "Stop" and stops it.

## Confirmed decision — listening is not practising

The demo must not touch `PracticeViewState`: not `nextEventIndex`, not the wrong-note set,
not the attempt counters, and so nothing of it reaches `AttemptHistory`. While it runs,
incoming MIDI is dropped rather than passed to `advancePracticeView` — a child playing along
would otherwise have every note recorded as an attempt, most of them wrong, since the engine
is still waiting where they stopped. Stop the demo, then play. Whatever restarts practice —
disconnecting, switching hands — stops the demo too, and so does unmounting.

## Confirmed decision — one fixed demo tempo, which is not a tempo control

`cicha-noc.musicxml` carries no tempo mark, and something has to turn `startTime` and
`durationBeats` (quarter-note beats) into milliseconds. One constant in the new module,
`DEMO_BPM = 66` in quarter notes — a shade slower than a performance because it is a
demonstration — tuned by ear in the manual check and then left alone. It does not go in
`src/config.ts`, which is the player-configurable presets, and a demo constant sitting there
reads as a knob somebody should wire up. Wait-mode practice stays untimed and the clock
introduced here runs only while the demo runs; what that rules out is under Out of scope.

## In scope

- **The schedule, as a pure value.** A new module turning a `Score` and a BPM into a list of
  timed steps:

  ```ts
  interface DemoStep {
    atMs: number;
    pitches: ReadonlySet<number>; // sounding from atMs; empty means silence
  }
  ```

  A `ReadonlySet` so it reaches `PianoKeyboard.heldNotes` without a per-render conversion.
  One step per `ScoreEvent` at its `startTime`, and **one event sounds at a time**: its notes
  stop at `min(startTime + durationBeats, next.startTime)`, and where that falls before the
  next event begins, an empty step goes in at that moment — the piece has one such gap, and
  since `parseScore` drops rests it survives only as this arithmetic. A final empty step
  closes the last event. The `min` itself is there to prevent overlap: a chord carries one
  `durationBeats` for all its notes — the longest of them, by `DECISIONS.md` — so without it
  a note-off would land in the middle of the next event's own copy of that pitch.

  **Note-off before note-on at every boundary**, including for pitches that appear in both
  steps. Eleven boundaries in this piece repeat a pitch; sending off only for departing
  pitches ties Cicha Noc's repeated melody notes into one sustained note on the real
  instrument, and on-before-off silences the new one instead.

- **The runner, one timer at a time.** Walk the steps with a single pending `setTimeout`,
  sending each step's messages as it falls due. **Do not schedule ahead with
  `output.send(data, timestamp)`**: Web MIDI has no `clear()` in Chromium, so a pre-scheduled
  piece would keep playing out of the instrument after Stop and after a disconnect — and the
  highlight needs a timer anyway, so pre-scheduling would be a second schedule to keep in
  step with the first. Stop clears the pending timer and sends note-off for whatever is
  sounding; a note left on by a stopped demo is the failure a real piano shows. Two traps:
  `handleEvent` is registered once at `attach()` time, so the flag that drops input while the
  demo runs has to be a ref, as `isRecordingRef` already is; and stop the demo from
  `handleHandsChange` and `disconnect`, the two places that already restart practice, rather
  than from an effect keyed on `score`, whose identity is stable only while both hands are
  selected.

- **Finding the output port**, using the names the hardware check printed. If the host shows
  exactly one output, take the sole output; if it shows several, match the piano by name.
  **Write only the rule the evidence supports** — the other branch is dead code, and the
  check happens before the code does. Either way the lookup answers `MIDIOutput | null` and
  nothing downstream asks why. `getMidiAccess()` in `WebMidiSource.ts` already returns the
  `MIDIAccess` carrying `outputs` beside `inputs`, and is module-private today, so export it
  or add the lookup beside `listMidiInputs`. **No second dropdown**: the player has already
  picked their piano once.

- **The highlight, with no change to `PianoKeyboard`.** While the demo runs, `App` passes the
  current step's pitches as `heldNotes` and an empty `expectedNotes`. The component, its CSS
  and its `data-` attributes are untouched: "this key is sounding now" is precisely what
  `heldNotes` already draws, and a third key state would mean new CSS, a new attribute and a
  new precedence rule for a cue that already exists. Blanking `expectedNotes` is deliberate —
  during a demonstration the only marks on the keyboard should be what is sounding, not a
  chord telling the player to do something else at the same time.

- The demo plays `score`, the hand-filtered one `App` already computes, so "Left hand" plus
  Listen demonstrates the left hand alone.

## Out of scope

- **Reusing `generatePerfectPerformance` or `ReplayMidiSource`.** Both already walk a score
  on a clock, and both are the wrong tool: the first is fixture machinery at a fixed
  `MS_PER_BEAT` with no way to express the clamp above, and the second feeds `handleEvent`,
  which is exactly what "listening is not practising" forbids.
- **The staff cursor following the demo.** It stays where the engine left it. Making it
  follow is a one-expression change to what `StaffView` is passed and the obvious next step,
  but it is not what was asked for, and step 16's cursor has only just landed.
- **Listening to the loop range only.** Listen plays from the top of the piece.
- Speed control, a count-in, a metronome: no slider, no 50% / 75%.
- Dynamics. One fixed velocity for every note, a constant beside the tempo.
- Sustain, program change, channel selection: channel 1, note on and note off, nothing else.
- Any change to the queue, the staff, the history, or the keyboard component.
- A test-only speed knob to make the Playwright check finish sooner. The gate below is
  written not to need one.

## Decisions to record in `DECISIONS.md`

- The sound comes from the instrument over MIDI out, the app has no audio of its own, and a
  null output port runs the demo silently rather than raising anything.
- Listening is not practising: the demo never touches engine or attempt state, and input is
  dropped while it runs.
- Messages are sent as they fall due rather than scheduled ahead, because Web MIDI cannot
  cancel a scheduled message and a stuck note on the real piano is the price.
- One event sounds at a time, and why: chords carry a single duration, and the highlight
  should match the cue practice gives.
- Amend the existing "Tempo is out of scope" entry rather than adding a fifth: the demo's
  fixed constant is not the slider coming back.

## Gate

- Layer 1/2: the step list for the opening bars at a known BPM — the opening chord's three
  pitches at 0 ms, the next event starting where that one ends, an empty step closing the
  piece. Cover the rest-shaped gap with a two-event fixture written for it rather than
  hunting for the one instance in `cicha-noc.musicxml`.
- Layer 2 over `App` with fake timers and a fake `MIDIOutput`: Listen sends note-on for the
  opening chord and note-off for it when the next step falls due, with the note-off first at
  a boundary that repeats a pitch; Stop sends note-off for what is sounding and nothing
  afterwards; a MIDI event arriving mid-demo leaves `PracticeViewState` untouched; and a null
  output runs the demo silently without surfacing an error. `WebMidiSource.test.ts` fakes the
  access object with unexported locals — lift what you need into a shared helper rather than
  writing a second fake, and keep it at the port boundary.
- **Layer 3 is the check that establishes the requested behaviour exists.** With the computer
  keyboard connected: click Listen, then poll immediately that `[data-held="true"]` is
  exactly the opening chord's three pitches and that nothing is marked expected — the chord
  holds for 1363 ms and the value does not come back once the demo moves on. Poll that the
  held set has moved on to the next event, then click Stop and assert the keyboard is back to
  the engine's state and `position-readout` never moved. Assert the first move, not the whole
  piece, which runs about 33 s.
- No committed screenshot, and put Listen on the existing Restart row so that nothing shifts
  — `DECISIONS.md`'s entry on the element snapshots gives the reason. Do not re-bless them.
- `npm run ci` green proves the schedule, the highlighting and that nothing else moved. It
  proves nothing about the sound: the container never talks to the piano, so the MIDI-out
  half is verified by hand and the report should say so rather than implying the suite
  covered it.

## Manual

Extend item 9 rather than adding a twelfth item, and keep it to three clauses: the piano
plays Cicha Noc while the on-screen keys follow it, Stop silences the instrument at once
with no note left sounding, and "Attempts" gained nothing from the demo. Say whether 66 BPM
suits a child following along. Expect the texture to sound thinner than the printed music —
one event sounds at a time, so bar 1's left-hand chord is released when the melody moves,
which is the decision above and not a fault.
