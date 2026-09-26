# Step 23 — Choosing how fast Listen plays

Adds a speed control to step 17's Listen demo: 50%, 75%, 100%, 125% or 150% of the demo's
one fixed tempo. Touches `src/config.ts`, `App.tsx`, `App.test.tsx`, `e2e/listen.spec.ts`,
the "Tempo is out of scope" entry in `DECISIONS.md` and item 9 of `MANUAL-CHECKS.md`. No
new dependency. One branch, `step-23-listen-speed`, off `main`.

## Goal

Let the player slow the demonstration down to follow it, or speed it up once they know
it. Today Listen always plays at `DEMO_BPM = 66` (`src/practice/demo.ts:9`), a constant
step 17 tuned by ear and deliberately gave no control.

## This reopens a closed decision, and only half of it

`prompts/README.md` lists tempo control under "Deliberately not planned", and
`DECISIONS.md`'s "Tempo is out of scope" entry says why. **This step reverses that for the
demo only.** Practice stays wait-mode, with no clock and no pace. The owner was asked
whether they wanted a timed practice mode as well and said no: what they wanted from
practice was for a child who knows the piece to be able to play it faster than the demo,
and wait-mode already allows that. `advance()` in `src/engine/advance.ts` moves on the
moment the expected note arrives, with no minimum interval. Its only use of the clock is
`earlyNoteGraceMs`, which accepts the notes of a chord that arrive slightly early. So
nothing on the practice side changes, and the README entry is narrowed rather than
removed.

## Confirmed decision — five fixed presets, as percentages

The owner chose fixed presets over a slider or − / + steps, and asked for them to go past
100%: **50%, 75%, 100%, 125%, 150%**, with 100% as the default. They are fractions of
`DEMO_BPM`, so the demo plays at `DEMO_BPM × speed`: 33, 49.5, 66, 82.5 or 99 quarter
notes a minute. `buildDemoSchedule(score, bpm)` already takes the BPM as a parameter, and
`demo.test.ts`'s "places the steps in beats whatever the tempo plays them at" already
checks that the schedule scales with it, so the step's whole effect on timing is the
argument at `App.tsx:154`. Five presets cost exactly what two would, so there is nothing to
save by offering only a "slow" option.

Percentages rather than BPM values, for two reasons. A child reads "50%" as "half speed"
without knowing what a BPM is. More importantly, once there is a second piece (step 22), it
may want a different base tempo, and "50% of this piece's tempo" still means the
right thing then, while a list of absolute BPMs would have to become a list per piece.

The presets go in `src/config.ts` as `DEMO_SPEED_PRESETS`, beside `KEYBOARD_PRESETS`,
because that file is "the presets the player can change", and these now are. `DEMO_BPM`
stays where it is: it is still the constant the percentages are taken of, not something
the player sets, and the comment above it that says it is not in `config.ts` stays true.
Each preset is `{ label: '75%', speed: 0.75 }`, the same shape of labelled value as
`KeyboardPreset`, so the control can find a preset by its label as
`KeyboardRangePicker` does.

## Confirmed decision — the speed is not remembered

The owner chose for the speed to reset to 100% on every page load. It is plain `useState`
in `App`, not stored in `localStorage` and not written anywhere. Unlike the keyboard width
and the queue fold, it is not a setting the player sets up once.

## Confirmed decision — a change applies to the next Listen

Changing the speed while the demo plays does not retime it. The new speed is read when
Listen is next pressed. This is what `handleListen` already does, since it builds the
schedule once when it creates the `DemoPlayer`, so no retiming code is needed. The
control stays enabled while the demo runs, so a child who hears the demo is too fast can
pick 50% at once and press Stop, then Listen, rather than having to stop first to find the
control unlocked. The cost is that a change made mid-demo is not heard until the next
Listen; the owner chose that behaviour over retiming or locking.

## The control

A `<select>` with a visible `<label>` reading "Speed", as `KeyboardRangePicker` has, and `data-testid="demo-speed-select"`, placed after the
Listen button **on the Restart row** and under the same `active.kind !== 'none'`
condition. Putting it on that row matters for the same reason it mattered in step 17: the
element snapshots (`DECISIONS.md`) break on any vertical shift of what sits below. If one
moves anyway, stop and report it rather than restyling the row to force it back. It is
written inline in `App.tsx`, not as a `DemoSpeedPicker` component: a component would sit
beside `KeyboardRangePicker` doing the same lookup for one caller, which the clean-code
standard counts as an abstraction with a single use, and five `<option>`s with a
find-by-label are a few lines.

The alternative weighed was a row of five buttons, which is flowkey's look. It was
rejected because a `<select>` is the idiom the app already uses for a list of presets
(`KeyboardRangePicker`), and it is the smaller control on a row whose height matters.

## Traps

- **Attempt history does not change.** Asked whether attempts should record the speed of
  the last Listen heard before them, the owner said no. The demo creates no attempts
  (step 17's "listening is not practising"), and the persisted and exported JSON shape stays
  as it is.
- **Stop, a hands change and a disconnect all still stop the demo, and none of them resets
  the speed.** The speed is a choice about the next demo, not part of the running one.
- `e2e/listen.spec.ts`'s comment "at 66 bpm a step of the demo can be as short as 455 ms"
  still holds at the default. At 150% the shortest step is about 303 ms, still well above
  the 50 ms poll.

## In scope

- `DEMO_SPEED_PRESETS` and its default in `src/config.ts`.
- The speed as `useState` in `App`, the `<select>`, and `DEMO_BPM * speed.speed` at the
  `buildDemoSchedule` call.

## Out of scope

- **A timed practice mode.** The owner does not want one: see above.
- **Remembering the speed**, by the owner's choice.
- **Retiming a running demo.** By the owner's choice; it applies on the next Listen.
- **Speeds outside 50–150%, or a slider.** The owner named the five.
- **Reading a tempo from the score.** `cicha-noc.musicxml` has no tempo mark. Step 22 keeps the demo's
  one constant on purpose (`step22.md`, Out of scope), so a per-piece base tempo is a later
  step's decision, taken once a piece that needs one exists.
- **Any change to `demo.ts`**: its schedule already takes the BPM.

## What this makes harder later

Nothing here is one-way: nothing is persisted and no exported shape changes. Two futures
were played forward. **More pieces, each with its own tempo:** `DEMO_BPM` would become a per-piece
base tempo, and the percentage presets would carry over unchanged, which is why they are
percentages. **Timed practice, if it is ever reopened:** the obvious control is the same
five percentages, and `DEMO_SPEED_PRESETS` would want renaming and its "applies on the
next Listen" rule revisiting — a small, reversible change. **A play-along mode**, where the demo sounds while the child plays: that
would need the demo and practice to share a clock, which step 17 deliberately kept apart.
A speed setting on the demo neither helps nor blocks that. Whether to build it is its own
question.

## Decisions to record in `DECISIONS.md`

Amend the "Tempo is out of scope" entry rather than adding a new one. The demo's speed is
now one of five player presets, which are percentages of `DEMO_BPM`, reset on load and
applied on the next Listen. Practice is still untimed because the owner does not want a
timed mode, and wait-mode already lets a player go as fast as they can. The speed is not
recorded with attempts, by the owner's choice: the demo creates none, and tying an attempt
to the last demo heard was judged too loose a signal to keep.

## Gate

- **Layer 1** needs no new test: `demo.test.ts`'s "places the steps in beats whatever the
  tempo plays them at" already checks that the schedule
  scales with the BPM it is given.
- **Layer 2, over `App` with fake timers and the fake `MIDIOutput` already in
  `App.test.tsx`. This is the check that establishes the behaviour exists.** Choose 50%,
  press Listen, and advance the clock past the moment the second step falls due at 100%
  (1364 ms): assert that no note-on for A4 has been sent yet, then advance past 2727 ms
  and assert that it has. This fails if the select is not wired to the schedule. Add a
  second case: change the speed while the demo runs and assert that the running demo's
  next step still falls due at the old time.
- **Layer 3**, in `e2e/listen.spec.ts`: the select defaults to "100%". Choose "50%", press
  Listen, poll until G4 is held, then assert once that G4 is still the only held pitch at a
  deadline of 1.8 s measured from the click (take `Date.now()` before clicking and wait out
  the remainder), not 1.8 s after the poll. At 100% the demo moves to A4 at 1364 ms, so
  this fails without the feature. The margin on the other side is about 900 ms before A4
  falls due at 2727 ms, which a slow runner is unlikely to use up but could. Leave the existing test at the default speed as it is.
- No committed screenshot, and do not re-bless the element snapshots. The control's
  placement exists so that they do not move.
- `npm run ci` green proves the timing of the schedule and the highlighting. It does not
  prove what the piano sounds like at 33 or 99 BPM, which is manual.

## Manual

In item 9 of `MANUAL-CHECKS.md`, replace "say whether 66 BPM is slow enough for a child
to follow along" rather than adding beside it: say whether 50% is slow enough for a child
to follow along, and at 150% repeated notes are
still heard as separate notes rather than as one smeared note.

## Finally

The Planned row in `prompts/README.md` and the narrowed "Tempo in practice" paragraph under
"Deliberately not planned" were added with this brief. Move the step to Shipped
when it lands.
