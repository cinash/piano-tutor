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

> **Status lives here and nowhere else.** The step files carry no `Status:` line; a brief
> records what was asked, and `git log` records what landed.

## Planned — making it legible to a player

Steps 9–14 answer one complaint: the screen shows colour-coded finger numbers and never says
_which key to press_, so the app cannot be used without the sheet music open beside it. The
reference point is flowkey — notation, a keyboard that shows the next keys, hand colours,
wait-mode — not a Synthesia-style falling-bar game. The app already matches flowkey on
wait-mode and on advancing only when you actually play; what is missing is the keyboard's half
of the conversation.

| Step                               | What it adds                                 | Size |
| ---------------------------------- | -------------------------------------------- | ---- |
| [9](step9.md) Keyboard range       | Derive it from the score: 4 octaves, C to B  | S    |
| [10](step10.md) Keys to play       | Highlight what the engine is waiting for     | S    |
| [11](step11.md) Hand colours       | Spend the `hand` field nothing has ever read | S    |
| [12](step12.md) Position readout   | "Measure 3 of 12"                            | XS   |
| [13](step13.md) Note names         | Label the white keys, C4 at middle C         | S    |
| [14](step14.md) One hand at a time | Practise left, right, or both                | M    |

**Order matters in two places.** Step 9 comes first because it settles the keyboard's width,
and step 10 commits the first keyboard screenshot — reversed, that snapshot is taken and
reviewed twice for one feature. Step 14 comes last because it consumes both the highlight and
the hand colours.

Step 10 is the one that matters. If only one of these six is ever built, build that one:
it is what turns the app from a display into a tutor. The rest are refinement.

## Deliberately not planned

**Sheet music.** The staff is the one flowkey feature with no cheap route, and the reason is
structural: `Score` drops rests and resolves ties into single events, so notation cannot be
rendered from it. It needs either OpenSheetMusicDisplay re-reading `cicha-noc.musicxml` at
runtime, or a second parse feeding VexFlow — a large pinned dependency against a 226 KB bundle,
plus reconciling OSMD's cursor with `nextEventIndex`. Worth doing deliberately, with its own
prompt and a measured bundle size. Not worth smuggling into one of the steps above, and not
worth doing before step 10, which solves the same problem for a fraction of the cost.

**Tempo and speed control.** flowkey's 50% / 75% practice speed is a tempo feature, and tempo
is out of scope by decision in `step5.md`. Wanting it back is a decision to reverse in the
open, not a gap to fill quietly.

**Recording which hand an attempt used.** Step 14 lets you practise one hand, and the history
then mixes one-hand and two-hand accuracy without labelling it. Adding `hands` to
`AttemptRecord` is a `localStorage` schema change with a data-destroying failure mode of its
own, so it is deliberately not part of step 14. Its own step, if the mixing turns out to
matter in practice.
