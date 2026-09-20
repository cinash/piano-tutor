# Step 19 — Find the piano's output port

Repairs step 17, which shipped a port rule that is wrong on the owner's host. Touches
`WebMidiSource.ts`, `practice/demo.ts`, `App.tsx` and their tests; no new module, no new
dependency, and nothing visible changes on screen. One branch, `step-19-output-port`, off
`main`.

## Goal

"Listen" lights the keys up and the piano stays silent. Make it sound.

The demo is not broken and neither is the instrument: the schedule, the highlighting and
the note-on/note-off bytes are all correct and all arrive at a port. The port is the wrong
one — or rather, no port at all, because the lookup gives up. `findMidiOutput()` in
`src/midi/WebMidiSource.ts:42` answers `null` unless the host shows exactly one output:

```ts
const outputs = Array.from(access.outputs.values());
if (outputs.length !== 1) return null; // WebMidiSource.ts:49
```

A `null` output is defined, correctly, as "play the schedule silently". So every branch
downstream behaves exactly as designed and the failure is invisible: the keys light up, no
error is raised, and the player is told nothing. That silence-by-design is what made this
survive a green `npm run ci`.

Step 17 offered two possible rules — take the sole output, or match the piano by name —
and said to write only the one the evidence supported. The evidence available in the
container supported neither; the sole-output rule was written anyway. It is wrong.

## The evidence, gathered at the instrument

The owner ran the check on the host this time, with the piano connected. Do not re-derive
any of this in the container, which has no MIDI at all.

The host is Linux, the browser is Vivaldi, and the piano is a Yamaha reporting itself as
`Digital Piano` (USB-Audio, card 1). ALSA shows **three** MIDI destinations, and Chromium's
Linux MIDI backend surfaces all three to `requestMIDIAccess`, so this is what
`access.outputs` contains:

```
client 14: 'Midi Through'   -> 0 'Midi Through Port-0'
client 20: 'Digital Piano'  -> 0 'Digital Piano MIDI 1'
                               1 'Digital Piano MIDI 2'
```

`access.inputs` carries the same three names. `Midi Through Port-0` is the kernel's ALSA
loopback (`snd_seq_dummy`); it is present on essentially every Linux desktop, it is not a
device, and it sounds nothing. Note what that means for the shipped rule: even if the
loopback were removed, the instrument alone still presents two output ports, so
`outputs.length` is never 1 on this host and no configuration change by the owner can make
it so. This is a code fix or nothing.

**The instrument sounds what it is sent, on both of its ports.** With the browser closed,
the owner sent raw note-on/note-off to each port in turn and heard the piano play:

```sh
# MIDI 1, then MIDI 2 — both sounded.
amidi -p hw:1,0,0 -S '90 3C 50'; sleep 1; amidi -p hw:1,0,0 -S '80 3C 00'
amidi -p hw:1,0,1 -S '90 3C 50'; sleep 1; amidi -p hw:1,0,1 -S '80 3C 00'
```

That settles the question step 17 opened and could not close: the premise holds, the piano
answers MIDI it receives over USB, and **no Web Audio synth is needed**. Do not propose one.

Three constraints follow, and the rule must respect all three: there are three outputs and
not one; `Midi Through` must never be chosen, because a demo sent into the loopback is
inaudible in exactly the way this step exists to fix; and either piano port sounds, so the
choice between `MIDI 1` and `MIDI 2` is not musically load-bearing — but it must be
deterministic rather than whichever the map happens to yield first.

One further note for `MANUAL-CHECKS.md`, learned the hard way while gathering the above:
the browser holds the ALSA rawmidi device **exclusively** for as long as a page has the
port open. `amidi` reports `Device or resource busy` until the tab is closed, and the
reverse is equally true. The two cannot be used at once.

## Confirmed decision — match the output to the input the player already chose

Step 17's "no second dropdown" stands. The player picks their piano once, in the input
dropdown, and the app adds no second control — this step changes nothing a player can see.

What makes that possible is that the choice has already been made and is already in hand.
`App` holds `active: ActiveSource`, and its `{ kind: 'webmidi'; deviceName: string }` arm
carries the selected input's name. The hardware exposes the _same names on both sides_:
`Digital Piano MIDI 1` is an input name and an output name. So the player's single choice
names the output too, and the lookup becomes a match rather than a guess.

The rule, in order:

1. **The output whose `name` equals the selected input's `name`.** On the owner's host,
   selecting `Digital Piano MIDI 1` sends the demo to `Digital Piano MIDI 1`.
2. **Failing that, the first output that is not the loopback** — excluded by matching its
   name against `/^midi through/i`. This is the branch for a host whose input and output
   names differ, and for the virtual-keyboard and replay sources, where no device has been
   chosen and there is no name to match. It is a guess, but a bounded one: the evidence is
   that any real port on this instrument sounds.
3. **Otherwise `null`**, which is every remaining case: no Web MIDI, a denied permission —
   which is what every Playwright run is — an empty `outputs` map, or a host whose only
   output is the loopback.

Write these three and no more. The sole-output special case disappears; it is subsumed by
rule 2 and keeping it as a fast path would be a fourth branch earning nothing.

**The contract does not change.** The lookup still answers `MIDIOutput | null`, a `null`
still plays the demo silently, and it still must not reach the `role="alert"` line or
hide or disable the Listen button. Pressing Listen with no piano attached remains a normal
thing to do. Nothing downstream asks _why_ the port is null and nothing should start.

## In scope

- **`findMidiOutput` takes the preferred name.** Signature becomes
  `findMidiOutput(preferredName: string | null): Promise<MIDIOutput | null>`, implementing
  the three rules above. It keeps its `try`/`catch` and its `await port.open()`.

- **`DemoPlayer` carries the name down.** The lookup stays inside `start()`, deliberately:
  it is what lets the `stopped` flag cover the await, and resolving the port earlier in
  `App` would mean holding a `MIDIOutput` in component state for no gain. Pass the name in
  through the constructor beside the steps and the callback.

- **`App.handleListen` supplies it** from the state it already has:
  `active.kind === 'webmidi' ? active.deviceName : null`. That expression is the whole
  change to `App.tsx`; `handleListen`'s existing ordering — both refs set before `start()`
  has finished looking for the port, so a second click stops this demo rather than starting
  another — is correct and must not be disturbed.

## Out of scope

- **An output picker, or any UI at all.** No second dropdown, no port readout, no "playing
  through…" line, no change to the Listen button's two states. If the port cannot be found
  the demo is silent, as it is today.
- **Reporting which port was chosen**, including a development-only `console.log`. The
  manual check below establishes the behaviour; a log line is a diagnostic for a problem
  that will have been fixed.
- **A Web Audio synth or a sampled piano.** The hardware check above removed the only
  reason to consider one.
- **Choosing between `MIDI 1` and `MIDI 2` on musical grounds**, or sending to both. One
  port, one channel.
- **Sysex, program change, channel selection, sustain, dynamics.** Unchanged from step 17:
  channel 1, note on, note off.
- Anything touching the schedule, the highlighting, the staff, the queue or the history.
  The bug is in the port lookup and the fix ends there.

## Decisions to record in `DECISIONS.md`

Amend the existing port entry rather than adding a new one — it currently states the
sole-output rule as the decision, and leaving that in place beside its replacement would
read as two rules in force.

- The demo's output port is matched by name to the input the player already selected, so
  the player still chooses their piano exactly once.
- Why the sole-output rule was wrong: on Linux the ALSA loopback `Midi Through` is always
  present and this instrument exposes two ports of its own, so an output count of one is
  the exception rather than the rule. Record the three names, as the evidence.
- The loopback is excluded by name, and a host offering nothing else yields `null`.
- Unchanged and worth restating where the amendment lands: a `null` port is not an error
  and runs the demo silently.

## Gate

- **Layer 1/2 over `findMidiOutput`,** with the fake `MIDIAccess` helper step 17 lifted out
  of `WebMidiSource.test.ts`, populated with the owner's three real port names so the
  regression is the fixture: it returns `Digital Piano MIDI 1` when that input is the
  preferred name and `Digital Piano MIDI 2` when that one is; it returns a piano port and
  **never** `Midi Through Port-0` when the preferred name is `null` or matches nothing; it
  returns `null` when the loopback is the only output; and it returns `null` when
  `requestMIDIAccess` rejects. Assert `open()` was awaited on the port that comes back.
- **Layer 2 over `App`** with fake timers and a fake output: with a Web MIDI device
  connected, Listen sends the opening chord's note-ons to the output _matching that
  device's name_ while a second, non-matching output receives nothing. That last clause is
  the one that would have caught this bug.
- **Layer 3 unchanged.** Playwright still runs with `requestMIDIAccess` rejecting, so the
  demo is still silent there and the existing assertions — the opening chord held, nothing
  expected, Stop restoring the engine's state, `position-readout` unmoved — must still pass
  untouched. If they need editing, something outside this step's scope has moved.
- `npm run ci` green.
- **Say plainly in the report that the suite proves nothing about the sound.** It proves
  the right port object is selected from a fake map. The container has no MIDI; whether the
  piano actually plays is the manual check below and only the owner can run it.

## Manual

Extend `MANUAL-CHECKS.md` item 9 — which step 17 already extended — rather than adding an
item. Three clauses: with the piano connected and selected in the dropdown, Listen plays
Cicha Noc out of the instrument; Stop silences it at once with no note left sounding; and
`Midi Through` being present alongside the two piano ports no longer prevents any of it.

Add one line of its own to the file, because it will otherwise be rediscovered every time:
close the browser tab before using `amidi` or `aplaymidi` on the host, and quit the tool
before returning to the browser — a page holding a Web MIDI port locks the ALSA device,
and the other side reports `Device or resource busy`.

Also worth the owner's ear while they are there, since step 17 never got a verdict on it:
whether `DEMO_BPM = 66` suits a child following along.

## Finally

Add step 19 to `prompts/README.md`. It is a repair rather than a feature, so give it its
own short section after step 18's — something like "Planned — making Listen audible" — with
the one-row table and a paragraph saying that step 17 shipped the highlighting and the
bytes but picked the port by a rule that no Linux host with a loopback can satisfy. Move
step 17 into the Shipped table at the same time, noting that what shipped was the visual
half. The step files carry no `Status:` line; that table is where the split lives.
