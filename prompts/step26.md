# Step 26 — Reconnect to the last piano

Remembers the piano the player last chose, and connects to it on its own whenever it is plugged in
and nothing else is connected: on page load, and when it is plugged back in while the page is
open. Adds `src/devices/lastPianoStore.ts`; touches `src/App.tsx`, `src/App.test.tsx`,
`src/midi/fakeMidiAccess.ts`, `DECISIONS.md` and items 2, 5 and 6 of `MANUAL-CHECKS.md`. No
dependency. Independent of steps 24 and 25. One branch, `step-26-remember-piano`, off `main`.

## Goal

The player's report: "it should remember the last selected device if this is available — I mean
the piano MIDI device." Today every page load starts "Not connected", and the piano has to be
picked from the dropdown again each time.

## Confirmed decision — auto-connect, not just preselect

The owner chose **auto-connect** over only preselecting the device in the dropdown: if the
remembered piano is among the connected inputs, the app connects to it without a click. That
applies whenever the input list changes, which covers both the page load and the piano being
plugged in, or switched on, while the page is open. The owner chose the piano only; choosing the
computer keyboard is not remembered.

## The choice, and what it rejects

**Remember the device's name, not its id.** Step 19 already matches the output port to the
selected input by name (`findMidiOutput`, `src/midi/WebMidiSource.ts:48`), because the name is
what identifies the instrument; Chrome's port ids are opaque and are not promised to survive a
browser restart or a different USB socket. If two connected inputs share the remembered name, the
first one is taken, which is what `findMidiOutput` does too.

**Stored the way the queue fold is.** `src/devices/lastPianoStore.ts` holds
`loadLastPiano(): string | null`, `saveLastPiano(name: string)` and `forgetLastPiano()`, under
`piano-tutor.last-piano.v1`, in the same shape as `src/practice/queueFoldStore.ts`. It is plain
`localStorage`, not part of the attempt history, and it is not exported with progress (step 8):
which piano is plugged into this computer is not progress, and on another computer it would be
wrong.

**When it is written and when it is forgotten.** It is saved when the player picks a device from
the dropdown. It is forgotten when the player presses **Disconnect** while the piano is connected:
that is the player saying "not this one", and an auto-connect that undid it on the next load would
be the app arguing back. It is **not** forgotten when the piano is unplugged; the unplug path
already calls `disconnect()` (`App.tsx`, the device-list effect), and remembering through it is
what makes plugging back in reconnect.

**Only when nothing else is connected.** If the player has chosen the computer keyboard or a
replay, plugging the piano in does not take over. Check `sourceRef.current === null` at the moment
of connecting, not React state, because the check runs in the device-list callback.

Rejected: **remembering the computer keyboard too**, by the owner's choice; and **auto-connecting
to any single MIDI device when nothing is remembered**, because a first visit should still show
the dropdown, and "the only device" is often "Midi Through".

## Traps

- **The unplug path and the button share `disconnect`.** Forget the piano in the button's handler
  (`onDisconnect` on `DevicePicker`), not inside `disconnect()`, or an unplug forgets the piano and
  replugging no longer reconnects.
- **Stale closures.** `refreshInputs` runs inside an effect keyed on `disconnect`, and
  `connectWebMidi` reads `webMidiInputs` from the render it was made in. Connect from the freshly
  listed inputs, not from state that has not re-rendered yet. An effect on `webMidiInputs` that
  connects when nothing is attached is one way; make sure it does not fire a second connect while
  the first `start()` is in flight.
- **Connecting resets practice and drops the loop** (`DECISIONS.md`, "Restart keeps the loop range;
  connecting a device drops it"). A replug mid-session therefore starts the attempt again. That is
  what a manual reconnect does today, and it stays.
- **`fakeMidiAccess` accepts a `statechange` listener and never calls it** (`fakeMidiAccess.ts:77`).
  The replug test needs it to: keep the listener and let a test fire it after changing an input's
  `state`. Update the comment.
- The Web MIDI permission prompt is unchanged: the device list already calls
  `requestMIDIAccess` on load.

## In scope

The store, the save and forget points, the automatic connect, and the tests below.

## Out of scope

- Remembering the output port separately: it follows the input by name already (step 19).
- Remembering the computer keyboard or a replay file.
- A "forget this piano" control beyond the existing Disconnect button.

## Open question for the owner

**Does choosing the computer keyboard forget the piano?** As written, no: only Disconnect forgets
it, so a player who switches to the computer keyboard gets the piano back on the next load if it is
plugged in. The alternative is that any other choice forgets it too. Recommendation: as written,
because the piano is what the app is for and the computer keyboard is mostly a stand-in when it is
not plugged in. If that is wrong, the cost is one reload that connects the piano when the player
wanted the computer keyboard, fixed with one click. The instructions above change only at the
`connectVirtual` and `loadReplayFile` call sites.

## What this makes harder later

A new `localStorage` key is the only persisted state, and it is versioned in its name as the other
keys are. Two futures were played forward. **Two instruments on one computer:** the name still
picks the right one, and a player switching between them picks from the dropdown, which re-saves.
**A settings page:** the key reads and writes through three functions, which a settings page could
call.

## Decisions to record in `DECISIONS.md`

A new entry: the last piano is remembered by name in `localStorage`, auto-connected whenever it is
listed and nothing else is attached, forgotten only by the Disconnect button, and not exported
with progress. Amend "A disconnected Web MIDI device silently drops the app back to 'Not
connected'" to say that plugging it back in now reconnects it.

## Gate

Layer 2, in `src/App.test.tsx`, over `fakeMidiAccess`. **The first case is the check that fails
without the step.**

- With `piano-tutor.last-piano.v1` set to a connected input's name, rendering the app reaches
  "Connected: Digital Piano MIDI 1" with no selection made.
- Choosing a device from the dropdown stores its name.
- Pressing Disconnect clears it, and a fresh render stays "Not connected".
- Unplug (input `state` set to `disconnected`, `statechange` fired): "Not connected", and the name
  is still stored. Plug back in: connected again, with no click.
- With the computer keyboard connected, plugging the remembered piano in leaves the computer
  keyboard connected.
- A stored name that matches no input leaves the app "Not connected" and the dropdown as it is.

Layer 1 for the store is not needed beyond what these cover. There is no Layer 3: the e2e suite has
no Web MIDI, and the container never talks to the piano, so `npm run ci` green does not prove that
the real P-145 is recognised by the same name after a reload. That is manual.

## Manual

Item 2: after selecting the piano once, reload the page and confirm it reads "Connected: <device
name>" with no click. Items 5 and 6: after unplugging, plug the cable back in and confirm it
reconnects on its own, without re-selecting; then press Disconnect, reload, and confirm it stays
"Not connected".

## Finally

Add the step to the Planned table in `prompts/README.md` (done with this brief); move it to
Shipped when it lands.
