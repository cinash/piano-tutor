# Step 29 — Timed play

Adds a second way to practise beside today's wait-mode. In **timed** play the piece moves on at
the chosen speed whether or not the player keeps up, and a note not played in time is counted as
missed. Touches `src/practice/practiceView.ts`, `src/practice/practiceView.test.ts`,
`src/practice/practiceState.ts`, `src/App.tsx`, `src/App.test.tsx`,
`src/progress/types.ts`, `src/progress/attemptStore.ts`, `src/progress/attemptStore.test.ts`,
`src/progress/AttemptHistory.tsx`, `src/progress/AttemptHistory.test.tsx`, `e2e/window.d.ts`, a
new `e2e/timed-play.spec.ts`, the "Practice is untimed" entry in `DECISIONS.md` and item 9 of
`MANUAL-CHECKS.md`. `src/engine/advance.ts` does not change. No new dependency. One branch,
`step-29-timed-play`, off `main`, in **three commits**, each passing `npm run ci` and each
through the code review on its own (below).

## Goal

The owner's ask: "a timed play with different speeds … selectable whether this should be waiting
mode as it is now or the timed play." Wait-mode lets a child play a piece note by note, as slowly
as they like, and never asks them to keep a beat. Timed play is the next stage: the same piece,
at a tempo the child picks, with the notes they did not get to in time counted.

## This reverses a closed decision

`prompts/README.md` lists "Tempo in practice" under "Deliberately not planned", and
`DECISIONS.md`'s "Practice is untimed; the Listen demo has speed presets" entry records that the
owner, asked during step 23, did not want a timed mode. **The owner has now asked for one.** This
step reverses that entry in the open rather than working round it. Wait-mode is kept exactly as
it is and stays the default: timed play is a second mode, not a replacement.

## Confirmed decisions

Asked four questions before this brief was written, the owner chose:

1. **The clock runs and misses pass.** Once started, the piece moves on at tempo whether or not
   the player plays; a note not played by its deadline is counted as missed and the next one is
   asked for. This is flowkey with its wait mode switched off. Rejected: a clock that stops and
   waits on a miss (a hybrid that never finishes a bar the child cannot play), and keeping
   wait-mode while scoring each note early or late (it never asks the child to keep going).
2. **The first note starts the clock.** Nothing moves until the player plays the first note the
   engine is waiting for, exactly as in wait-mode; from that note on, the clock runs. Rejected: a
   Start button with a one-bar count-in, on screen or clicked on the piano. The first-note rule
   needs no new control, and Listen at the same speed is how the child hears the tempo first.
3. **Nothing extra sounds.** The player hears only what they play. Rejected: a metronome click
   through the piano's output, and the app playing the other hand along. Both are named under
   "What this makes harder later".
4. **Timed play shares Listen's Speed select.** Step 23's five presets, 50% to 150% of
   `DEMO_BPM` (66 quarter notes a minute), set the tempo of both. Rejected: a second select, which
   would let the child practise at a speed they had not heard. `DEMO_SPEED_PRESETS` keeps its
   name: renaming it touches every caller for no behaviour.

## How timed play works

**Where the clock lives.** Every piece of timed state goes in `PracticeViewState`, as one
optional field:

```ts
/** Set while a timed run's clock is running; absent in wait-mode and before the first note. */
clock?: { startedAt: number; startTime: number; msPerBeat: number };
```

`startedAt` is the MIDI clock time of the note that started it, `startTime` the score position
(in quarter-note beats) of the event that note completed, and `msPerBeat` is `60000 / (DEMO_BPM ×
speed)` as it was when the clock started. An event's **due time** is then
`startedAt + (event.startTime − startTime) × msPerBeat`. Because the field lives in the view
state, every path that already resets practice — Restart, a piece change, a hands change,
`attach()`, `disconnect()` — also stops the clock, with no new code in any of them.

The **mode** is not in the view state. It is `useState<'wait' | 'timed'>` in `App`, defaulting to
`'wait'`, and the reducers are told the tempo to start a clock with:
`advancePracticeView(state, score, event, clock, startTempo)`, where `startTempo` is the
`msPerBeat` in timed mode and `null` in wait-mode. The view state carries only what the run is
doing, not what the player chose. Rejected: a `mode` field in `PracticeViewState`, which
`createInitialPracticeViewState()` would have to be told on every one of those resets.

**Starting.** With no `clock`, a note is judged as in wait-mode today. When a note completes the
current event and `startTempo` is not null, the clock starts at that note: `startedAt` is the
note's `clock` argument, `startTime` the completed event's. So the first event is always played in
wait-mode, and the second falls due one note-length later at the chosen speed.

**The window.** With a clock running, an event can be played from a quarter of a beat before its
due time until a quarter of a beat after — **±0.25 quarter-note beats**, `0.25 × msPerBeat`: 227 ms
at 100%, 455 ms at 50%, 152 ms at 150%. A fraction of a beat rather than a fixed number of
milliseconds, so slowing down is also more forgiving, and so that for any note an eighth or
longer, one event's window closes exactly where the next one's opens. Only sixteenths and
faster overlap, and no offered piece has them. Put the fraction beside the reducer as
`TIMED_WINDOW_BEATS = 0.25`, not in `ENGINE_TIMING`, whose comment says it is what `advance()`
tunes. Rejected: a fixed ±150 ms, which is strict for a child at 50% and loose at 150%.

- **Played in the window:** judged exactly as in wait-mode — `advance()` credits it, and once the
  chord is complete the engine moves on.
- **Played too early** (the current event's pitch, before its window opens): a **wrong note**. It
  is flagged in red and counted in `wrongNoteCount`, and `advance()` is not called with it, so the
  event is still waiting. It still updates `heldNotes`, so the key lights. Without this, a child
  who knows the piece could play it at any speed and timed play would ask nothing of them.
- **Not played by its deadline** (due time + the window): **missed**. Each pitch of the event not
  yet played adds one to a new `attempt.missedNoteCount`, and the engine moves on as if the event
  had been completed, through `nextIndexAfter()`, so a loop wraps and the last event completes
  the piece. `satisfiedNoteIds` and `pendingEarlyNotes` are cleared, as a completion clears them.
  An event cannot miss twice.

Wrong notes still count only notes played, and missed notes only notes not played, so a note is
never in both.

**Missing on a clock nobody plays to.** Nothing arrives from the piano while the child sits still,
so something has to move the engine on at each deadline. Add a pure reducer beside
`advancePracticeView`:

```ts
/** Every event whose deadline has passed by `now` is missed, in order. No clock: unchanged. */
export function expireDueEvents(
  state: PracticeViewState,
  score: Score,
  now: number,
): PracticeViewState;
```

It returns `state` itself, by identity, when nothing has expired, so a call that changes nothing
does not re-render. `App` calls it from a `setTimeout` set, in an effect keyed on the view state,
for the current event's deadline, as `DemoPlayer` times its steps. Not a `setInterval` poll, which
re-renders twenty times a second for nothing.

**The clock is `performance.now()`.** `MidiEvent.time` is a `performance.now()` reading from the
computer keyboard and Web MIDI's `timeStamp` from the piano, which is on the same timeline; the
timeout must read the same clock, not `Date.now()`, which `DemoPlayer` uses and which is a
different number. Vitest 5's fake timers fake `performance.now()` along with `setTimeout`, so the
App tests can drive it.

**The loop.** When the engine wraps back to the loop's first event — by a completion or by a miss
— the clock stops, so the loop's first note starts it again, and the child gets a breath between
passes. Rejected: running on through the wrap at tempo, which needs the length of the loop's last
bar, and the score has no bar ends: `parseScore` drops rests, so a loop ending in a rest has no
event to measure to. The attempt carries on across the wrap, as it does in wait-mode.

**The speed** is read when the clock starts, as step 23 reads it when Listen is pressed. A change
mid-run is used from the next start: after a Restart, and at the next loop pass. Rejected:
retiming a running clock.

**Switching mode** restarts practice (`restartPractice`, keeping the loop), as a hands change
does: a run half in one mode and half in the other is not an attempt of either.

**Listen during a timed run** stops the clock, keeping the place. While the demo plays, practice
ignores every note (`handleEvent`'s early return), and a clock left running would miss every
event under it. After Stop, the note practice is waiting for starts the clock again.

## The screen

**The control.** Two radios, "Wait" and "Timed", after the Speed select **on the Restart row**,
under the same `isConnected` condition, with `data-testid="mode-wait"` and `"mode-timed"`. Radios
rather than a `<select>`, for the reason the hands radios give (`App.tsx:83`): a focused select
jumps option on a typed letter, and the computer keyboard plays letters. On that row because the
element snapshots break on any vertical shift of what sits below the controls (`DECISIONS.md`);
if one moves anyway, stop and report it rather than restyling the row to force it back. Rejected:
a single "Timed" checkbox, which is smaller but does not say what the other mode is.

**The staff cursor follows the clock** (commit 2). While a clock runs, the cursor marks the last
event whose due time has passed — where the music has got to — and moves on at each due time,
as it follows the Listen demo. The keyboard's highlighted keys and the finger queue still show
the event the engine is waiting for. This is step 20's split applied to practice: the cursor says
where we are, the queue says what to play. Without it nothing on screen shows the tempo, and a
child has no way to see they are late until a note disappears. Rejected: a cursor on the note to
play, as in wait-mode, which in timed play sits still until the player acts and shows no beat. The
timeout above is set for whichever comes first, the next due time or the current deadline. `App`
keeps the score position the clock has reached as state, set by that timeout, as `demoStep` is set
by `DemoPlayer`; a due time moves it without changing the engine.

**No miss marker, no live count.** A missed event leaves no mark on screen; the count is in the
attempt history. The child is watching the keys, not a number. Out of scope below.

## Attempt history

Recorded where the data first exists, which is the owner's standing rule: history recorded
without a field cannot be backfilled. `AttemptRecord` gains one optional field:

```ts
timed?: { speed: number; bpm: number; missedNoteCount: number };
```

Present on a timed attempt, absent on a wait-mode one — which is also what every record written
before this step says, so no stored or exported history becomes wrong. `speed` is the preset's
fraction (0.75), and `bpm` the tempo actually played at (49.5): the first keeps its meaning if a
piece later gets its own base tempo, and the second is the fact itself if `DEMO_BPM` changes.
`isAttemptRecordArray` accepts a record with no `timed` and checks the three numbers when there is
one. Rejected: a required `mode` field, which would make every record already stored and
exported fail validation and read as no history.

The history table gains two columns: **Mode**, "Wait" or "Timed 75%", and **Missed**, the count
for a timed attempt and "—" for a wait-mode one. Accuracy keeps its meaning — of the notes played,
how many were right — so it says nothing about misses, and the Missed column beside it does.
Rejected: folding misses into accuracy, which would make a timed 90% and a wait-mode 90% mean
different things in the same column.

## Traps

- **The replay source cannot drive timed play.** `ReplayMidiSource` re-emits a recording with the
  `time` it was recorded with, which is not on this page's `performance.now()` timeline, so every
  deadline would fall in the past at once. It is a dev-only tool; say so in a comment where the
  clock is started rather than converting its timestamps.
- **`advance()` does not change.** Its early-note grace (`ENGINE_TIMING.earlyNoteGraceMs`) still
  credits a note of the _next_ event played a hair before the current one completes; the window
  above governs the _current_ event. The too-early check is in `advancePracticeView`, before
  `advance()` is called.
- **A miss is not a completion for the purposes of the early-note credit.** When `expireDueEvents`
  moves on, it clears `pendingEarlyNotes` rather than crediting them: a note of the next event
  played while the current one was still unplayed was played before its own window.
- **`wrongNotes` is cleared by note-offs, not by the clock.** A too-early note stays red while it
  is held, as a wrong note does today.
- **The snapshot for e2e** (`src/practice/practiceState.ts`, duplicated in `e2e/window.d.ts`)
  gains `missedNoteCount`, which the Layer 3 test reads. Keep the duplicate in step.

## Three commits

Each stands on its own and each passes `npm run ci`:

1. **Timed play.** The mode radios, the clock, the window, misses and `expireDueEvents`, the
   loop and Listen rules. The cursor still follows the engine.
2. **The cursor follows the clock.**
3. **History records it**: `AttemptRecord.timed`, its validation, and the two columns.

## In scope

- Everything under "How timed play works", "The screen" and "Attempt history" above.

## Out of scope

- **A metronome, a count-in, or the other hand playing along.** The owner chose silence.
- **Remembering the mode across a reload.** It resets to Wait, as hands and speed reset. A child
  opening the app is not dropped into a clock they did not choose.
- **A per-note miss marker or a live score on screen.** The history shows the count.
- **Speeds outside step 23's five, or a slider.**
- **A continuously scrolling staff**, flowkey's moving sheet. OSMD's cursor moves note to note;
  step 25's glide is what the staff has.
- **Timed play from a replayed recording**, above.

## What this makes harder later

The one thing that is not reversible is the **persisted and exported history shape**: the new
optional `timed` object. It is additive, older app versions ignore it (`isAttemptRecordArray`
does not reject unknown fields), and no existing record changes — but once children's progress
files carry it, its fields have to keep meaning what they mean here.

Three futures, played forward:

- **A metronome or count-in later.** The clock's `startedAt` and `msPerBeat` are exactly what a
  click schedule needs; nothing here would be undone. A count-in would change "the first note
  starts the clock" to "the count-in does", which moves one line of `advancePracticeView`.
- **The other hand playing along.** This needs the demo and practice to share a clock, which
  step 17 deliberately kept apart. The `clock` field gives practice a clock to share; the demo's
  `DemoPlayer` runs on `Date.now()` from its own start and would have to be re-anchored to it.
  Not blocked, not helped much.
- **A per-piece base tempo.** `DEMO_BPM` becomes per piece; `speed` in the record keeps its
  meaning and `bpm` records the absolute tempo either way.

## Decisions to record in `DECISIONS.md`

Retitle and amend "Practice is untimed; the Listen demo has speed presets; the falling-note view
will not animate on a clock" rather than adding a new entry: practice has two modes now, wait-mode
the default. Record the four owner choices above; that timed play shares Listen's speed; the
±¼-beat window and why it is a fraction of a beat; that a too-early note is wrong; that a loop
wrap stops the clock and why; and that the falling-note queue still does not animate on the
clock — only the staff cursor follows it. Add a short entry for `AttemptRecord.timed`: optional so
that no stored or exported history is invalidated, with both `speed` and `bpm`.

## Gate

- **Layer 1, `src/practice/practiceView.test.ts`, over a hand-built score at a round tempo.** The
  first note starts the clock at that note's time and at the tempo given; in wait-mode it does not.
  A note played in its window advances; a correct pitch played before the window is a wrong note
  and does not advance; `expireDueEvents` past a deadline misses every unplayed pitch of the event
  and moves on, and past two deadlines misses both; it returns the same object when nothing is
  due; a miss on the last event completes the piece; a wrap stops the clock; with no clock it
  changes nothing.
- **Layer 2, `src/App.test.tsx`, over `App` with the computer keyboard and fake timers. This is
  the check that establishes the behaviour exists.** Choose Timed, play Cicha Noc's first G4, and
  advance the clock past 1591 ms (A4's deadline at 100%): the position has moved past A4 without it
  being played. The same with Wait selected: still waiting on A4. A third case: with 50% chosen,
  1591 ms is not enough and 3182 ms is. A fourth: Listen during a timed run stops the clock, so
  advancing 10 s under the demo leaves practice where it was.
- **Layer 2, the history.** `attemptStore.test.ts`: a record with no `timed` is accepted, one with
  a malformed `timed` is rejected. `AttemptHistory.test.tsx`: the two columns for each mode.
- **Layer 3, a new `e2e/timed-play.spec.ts`.** Choose "Timed", play G4 through the computer
  keyboard, then play nothing: poll `window.__practiceState` until `missedNoteCount` is at least 1
  and `nextEventIndex` has passed 1. Wait-mode's "no timeout" is already covered by the existing
  specs and needs no copy here.
- No committed screenshot, and do not re-bless the element snapshots.
- `npm run ci` green proves the clock, the window and the counting. It does not prove that a
  child can keep time with no sound, or that ±¼ beat is fair on a real piano — that is manual.

## Manual

In item 9 of `MANUAL-CHECKS.md`, after the Listen speed sentences: choose "Timed" at 75%, play the
first bars of Cicha Noc in time, and confirm the notes are accepted and the cursor moves with the
beat; stop playing and confirm the piece moves on without you; say whether ±¼ beat feels fair to a
child at 50% and at 100%, and whether the moving cursor is enough to keep time by with no click.

## Finally

Add step 29 to `prompts/README.md` under a new "Planned — playing in time" heading, and replace
the "Tempo in practice" paragraph under "Deliberately not planned" with a line saying step 29
reopened it at the owner's request. Move the step to Shipped when it lands.
