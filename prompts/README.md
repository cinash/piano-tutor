# The plan, step by step

One file per step. Each is the brief that was — or will be — handed to an implementing agent,
and each outlives the work as the record of what was actually asked, alongside `DECISIONS.md`
for the non-obvious choices and `MANUAL-CHECKS.md` for what only a real piano can confirm.

## Shipped

| Step                            | What it added                                       |
| ------------------------------- | --------------------------------------------------- |
| [1](step1.md) MIDI plumbing     | `MidiSource` × 3, device picker, on-screen keyboard |
| [2](step2.md) Score parsing     | MusicXML → `Score`, ties resolved, rests dropped    |
| [3](step3.md) Practice engine   | Wait-mode `advance()`, no timeout, early-note grace |
| [4](step4.md) Falling-note view | The finger queue, five finger colours, no clock     |
| [5](step5.md) Loop selection    | A measure range that wraps                          |
| [6](step6.md) Restart           | Restart, and what one attempt contains              |
| [7](step7.md) History           | `localStorage` attempts, newest first               |
| [8](step8.md) Progress transfer | Export and import the history as JSON               |
| [17](step17.md) Listen          | Keys lighting up to the piece; the sound took 19    |

> The step files carry no `Status:` line; this table is where the shipped/planned split lives.

## Planned — making it legible to a player

Steps 9–14 answer one complaint: the screen shows colour-coded finger numbers and never says
_which key to press_, so the app cannot be used without the sheet music open beside it. The
reference point is flowkey — notation, a keyboard that shows the next keys, hand colours,
wait-mode — not a Synthesia-style falling-bar game. The app already matches flowkey on
wait-mode and on advancing only when you actually play; what is missing is the keyboard's half
of the conversation.

| Step                               | What it adds                                 |
| ---------------------------------- | -------------------------------------------- |
| [9](step9.md) Keyboard range       | Pick the width: 4 octaves, 5, or all 88 keys |
| [10](step10.md) Keys to play       | Highlight what the engine is waiting for     |
| [11](step11.md) Hand colours       | Spend the `hand` field nothing has ever read |
| [12](step12.md) Position readout   | "Measure 3 of 12"                            |
| [13](step13.md) Note names         | Label the white keys, C4 at middle C         |
| [14](step14.md) One hand at a time | Practise left, right, or both                |

**Order matters in two places.** Step 9 comes first because everything after it draws on the
keyboard, and its width decides what "the keyboard" is. Step 14 comes last because it consumes
both the highlight and the hand colours. Step 13 owns the single committed screenshot of the
keyboard, taken once the element is finished rather than updated by each step that touches it.

Step 10 is the one that matters. If only one of these six is ever built, build that one:
it is what turns the app from a display into a tutor. The rest are refinement.

## Planned — the notation

The other half of the same complaint: steps 9–14 make the screen say which key to press, and
these two make it show what is written.

| Step                         | What it adds                                     |
| ---------------------------- | ------------------------------------------------ |
| [15](step15.md) The staff    | OpenSheetMusicDisplay draws `cicha-noc.musicxml` |
| [16](step16.md) Staff cursor | The marker follows `nextEventIndex`              |

**Split on purpose, and in this order.** Step 15 carries the dependency and the bundle
measurement, so a renderer that proves too heavy is found before step 16's mapping is written
rather than after. Step 16 carries the only hard problem in the pair, which `step16.md`
explains.

Both are worth doing after step 10, which answers the same complaint for a fraction of the
cost.

## Planned — making room for the staff

| Step                           | What it adds                              |
| ------------------------------ | ----------------------------------------- |
| [18](step18.md) Fold the queue | A control that puts the finger queue away |

Step 15's consequence rather than a new idea: with 320 px of staff on screen the column no
longer fits a laptop window, and the on-screen keyboard — the one element that has to be
visible while the hands are on the real piano — is the thing that falls off the bottom. Asked
for by the player as soon as the staff landed. It depends on step 15 only for the reason it
exists, so it can be built before or after step 16.

## Planned — making Listen audible

| Step                        | What it repairs                               |
| --------------------------- | --------------------------------------------- |
| [19](step19.md) Output port | The demo reaches the piano instead of nowhere |

Step 17 shipped the highlighting and the right note-on and note-off bytes, but chose the
output port by a rule no Linux host can satisfy: the sole output, where the ALSA loopback
`Midi Through` is always present and the piano offers two ports of its own besides. The
lookup therefore gave up and answered null, which is defined — correctly — as "play the
schedule silently", so the keys lit up, nothing was reported and `npm run ci` stayed green
over a demo nobody could hear. A repair rather than a feature: nothing on screen changes.

## Deliberately not planned

**Tempo and speed control.** flowkey's 50% / 75% practice speed is a tempo feature, and tempo
is out of scope by decision in `step5.md`. Wanting it back is a decision to reverse in the
open, not a gap to fill quietly. Step 17's demo has to pick a speed to play at and so carries
one fixed constant, but that is a property of the demonstration: practice stays untimed and
there is still no control.

**Recording which hand an attempt used.** Kept out of step 14, which says why. Its own step,
if the mixing turns out to matter in practice.
