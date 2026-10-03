# The plan, step by step

One file per step. Each is the brief that was — or will be — handed to an implementing agent,
and each outlives the work as the record of what was actually asked, alongside `DECISIONS.md`
for the non-obvious choices and `MANUAL-CHECKS.md` for what only a real piano can confirm.

Before a brief is handed over it goes through the planning gate in `CLAUDE.md`: two reviewers
that argue with the plan rather than with code — one about whether it is the right thing to
build, one about what it leaves unsaid — and that put what only the owner can decide back to
them rather than settling it. `.claude/skills/planning-docs/SKILL.md` is the standard they
judge a brief against, and the guide for writing one.

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
| [19](step19.md) Output port     | The demo's port, matched to the piano by name       |
| 21 The owner's own piece        | `cicha-noc.musicxml` replaced by the owner's ABC    |
| [22](step22.md) Choose piece    | A dropdown of 23 pieces; controls in two rows       |
| [23](step23.md) Listen speed    | Demo speed presets, 50%–150%; practice untimed      |
| [24](step24.md) Left hand lower | Left hand an octave down, bass clef, fingering      |
| [25](step25.md) Staff scroll    | The marker held a third of the way in, gliding      |
| [26](step26.md) Remember piano  | Reconnects to the last piano when it is plugged in  |
| [27](step27.md) Hand position   | Each hand's five keys numbered, next one outlined   |
| [29](step29.md) Timed play      | Timed mode on a metronome; misses in the history    |

> The step files carry no `Status:` line; this table is where the shipped/planned split lives.

Step 21 has no file of its own: it was asked for directly rather than planned, and what was
asked is recorded in its commit message and in `DECISIONS.md` instead. It swapped the
self-authored 6/8 score for the owner's own arrangement — 3/4, both hands in treble clef,
the hands taking the melody in turn, and its repeat written out rather than notated. Step 24
later moved its left hand an octave down, into bass clef.

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

## Planned — the cursor follows the demo

| Step                           | What it repairs                                    |
| ------------------------------ | -------------------------------------------------- |
| [20](step20.md) Cursor follows | The staff marker moves with the demo, not practice |

The other half of step 17's unfinished wiring, reported by the player once step 19 made the
demo audible: the keys light up and the piano plays, but the green cursor stays on the note
practice is waiting for. Step 17 gave the keyboard a second source while the demo runs and
never gave the staff one. The queue stays with practice on purpose — the cursor says where
we are, the queue says what to play, and nothing is asked for during a demonstration.

## Planned — more than one piece

| Step                           | What it adds                                   |
| ------------------------------ | ---------------------------------------------- |
| [28](step28.md) Beyer, scanned | All of Op. 101 recognised, proofread, fingered |

Step 21 replaced the one piece; step 22, now shipped, stopped it being the only one. The
Beyer import supplied the rest: Nos. 8, 9 and 12–31, offered in a dropdown in book order after
Cicha Noc from an explicit list with a hand-written id per piece — No. 38 until its fingering
is complete, and Nos. 10 and 11 until the owner says which book's numbering the child reads,
are left out. It first packs the controls above the staff into two rows. The choice is
remembered across a reload, and each attempt records its piece and hands, for the
learn-in-order mode the owner has said comes later; the history recorded before it is, by the
owner's word, not carried forward.

Two things in the app do not fall out of a piece swap on their own, and the brief names
both: the staff loads its XML in an effect that never runs again, so it would keep drawing
the old score, and a restart deliberately keeps the loop, which a shorter piece has no bars
for. Pieces are bundled at build time rather than picked from disk, for the same reason the
replay picker is dev-only.

Step 28 turns the Peters scan of Beyer's Op. 101 into proofread, fingered MusicXML, in batches,
and bundles none of it: a file reaches the child when a line for it is added to step 22's list of
pieces.

## Planned — the owner's own music

| Step                      | What it adds                                           |
| ------------------------- | ------------------------------------------------------ |
| [30](step30.md) Own music | The owner's fingered MusicXML, uploaded in the browser |

Step 22 made the pieces a build-time list on purpose, so the owner's own arrangement cannot reach
the child without a rebuild. This step reverses that for uploads. Uploads can neither replace nor remove a
piece. The plan gate's round cap was reached with one owner decision open (rhythm the Timed mode cannot keep
time through, refused by default), so the brief is handed back for that answer.

## Deliberately not planned

**Tempo in practice** was here until the owner asked for timed play; step 29 reopened it in
the open, retitling the "Practice is untimed" entry in `DECISIONS.md` to "Practice waits by
default and can be timed".
