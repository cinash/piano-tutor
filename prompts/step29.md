# Step 29 — Timed play

Adds a second way to practise beside today's wait-mode. In **timed** play a metronome clicks the
chosen speed from the computer's speakers, the piece runs on a fixed clock from the child's first
note, and a note not played in time is counted as missed while the music goes on. Adds
`src/practice/timedPlay.ts`, `src/practice/timedPlay.test.ts`, `src/practice/metronome.ts`,
`src/score/measureStartTime.ts`, `src/score/measureStartTime.test.ts` and
`e2e/timed-play.spec.ts`; touches `src/practice/practiceView.ts`,
`src/practice/practiceView.test.ts` (the new `advancePracticeView` argument, and `attempt`
asserted with exact `toEqual`), `src/practice/practiceState.ts`, `src/score/pieces.test.ts`,
`src/App.tsx`, `src/App.test.tsx`, `src/progress/types.ts`, `src/progress/attemptStore.ts`,
`src/progress/attemptStore.test.ts`, `src/progress/AttemptHistory.tsx`,
`src/progress/AttemptHistory.test.tsx`, `e2e/window.d.ts`, `e2e/history.spec.ts` and
`e2e/progress-transfer.spec.ts` (both assert every cell of a history row), `DECISIONS.md` and item 9
of `MANUAL-CHECKS.md`. `src/engine/advance.ts` does not change. No new dependency: the click is Web
Audio. One branch, `step-29-timed-play`, off `main`, in **four commits**, each passing
`npm run ci` and each through the two-reviewer code gate in `CLAUDE.md` on its own.

## Goal

The owner's ask: "a timed play with different speeds … selectable whether this should be waiting
mode as it is now or the timed play." Wait-mode lets a child play a piece note by note, as slowly
as they like. Timed play is the next stage: the same piece at a tempo the child picks, with a beat
to play to, and the notes they did not get to in time counted.

## This reverses two closed decisions

`prompts/README.md` listed "Tempo in practice" under "Deliberately not planned", and `DECISIONS.md`
("Practice is untimed; the Listen demo has speed presets") records that the owner, asked during
step 23, did not want a timed mode. `DECISIONS.md` ("The demo is played by the piano; the app makes
no sound of its own") records that at step 17 the owner chose the piano over a Web Audio synth for
the demo. **The owner has now asked for timed play, and chose a metronome from the computer**,
knowing the piano has no click the app can start or keep in step with (decision 3). Both entries are amended in the open. Wait-mode is kept
exactly as it is and stays the default, and the demo still plays through the piano.

## The standard design

Timed play in Synthesia, Simply Piano, rhythm games and flowkey with wait mode off works the same
way: **the music is the clock**. It runs at a fixed tempo and never adjusts to the player; each note
has a small window around its own time; a key inside the window is a hit, a window that closes
unplayed is a miss, and the player keeps time by ear. A child who stops simply comes back in with
the beat. This brief builds that, with a metronome as the beat.

## The owner's decisions

1. **The clock runs and misses pass.** Once started, the piece moves on at tempo whether or not the
   player plays. Rejected: a clock that stops and waits on a miss; wait-mode with each note scored
   early or late.
2. **The metronome clicks from the moment Timed is chosen, and the first note starts the run,
   snapped onto the nearest click.** The child hears the tempo before playing, and there is no
   button to press. Rejected: a Start button with a one-bar count-in, which adds a control and a
   wait; and the first note starting both clock and click, which judges the second note after at
   most one click.
3. **The metronome sounds from the computer's speakers, on by default, and can be switched off.**
   Off, the moving cursor and the highlighted keys are the only cue. Rejected: a click sent to the
   piano as a note — the P-145's MIDI Reference lists ten melodic voices, no percussion and no
   metronome message, so it would be a piano note blending with the child's; the piano's own
   metronome, set by hand, which the app can neither start, set to 49.5 BPM, nor find the beat of,
   so no note could be snapped to it; the song from the speakers, which needs piano samples (a new
   dependency) and plays the child the answer.
4. **Timed play shares Listen's Speed select**, step 23's five presets, 50% to 150% of `DEMO_BPM`
   (66 quarter notes a minute). Rejected: a second select.
5. **A fixed clock** — the standard design. Rejected: a clock that re-syncs to each note played.
6. **A right key at the wrong time is red but not counted wrong.** It lights red and counts in
   `notesPlayed`, not in `wrongNoteCount`, so accuracy means "the right keys" in both modes and
   timing shows up as misses. Rejected: counting it wrong; ignoring it silently.
7. **History records timed attempts and shows them**, with Mode and Missed columns.
8. **"Reached end" means the player's own note finished the piece.** A run the clock carried to the
   end after the child had stopped reads "no".
9. **History records the child's own timing: how early or late on average, and how tight.** Three
   counters (below). Rejected: early/late alone, where a child ±200 ms at random averages near zero
   and looks perfect; and recording nothing.
10. **With a loop set, the bars before it are played untimed**, as in wait-mode, and the clock starts
    on the first right note inside the loop. Rejected: timing the lead-in, which makes the child sit
    through it at tempo on every Restart and counts what they skip as missed; and Restart jumping
    to the loop's first bar, which would change Restart in both modes.
11. **A timed loop pauses after one whole silent pass.** When a loop's length has gone by with no
    note played, the clock stops (the metronome keeps clicking) and the next right note starts a
    new one on the beat. A loop never ends, and a child who walks away would otherwise collect
    misses by the hundred. Rejected: running on forever; pausing after a fixed number of misses.

The owner expects the loop to be little used and may remove it later to simplify; for now it stays,
with no more timed-play rules than these two.

## How timed play works

**The metronome's grid.** While Timed is chosen, a source is connected and the metronome checkbox is
on, the metronome clicks every quarter-note beat at the chosen speed, starting at once — a grid
`{ origin: number; msPerBeat: number }` in `performance.now()` time, `msPerBeat` =
`60000 / (DEMO_BPM × speed)`. With the metronome off there is no grid.

**The clock.** One optional field in `PracticeViewState`:

```ts
export interface TimedClock {
  startedAt: number; // performance.now() time at which score position `startTime` fell due
  startTime: number; // quarter-note beats
  msPerBeat: number;
  passBeats: number; // loop length × passes completed; 0 without a loop
  lastNoteAt: number; // performance.now() time of the last note-on, for decision 11
}
timedClock?: TimedClock;
```

An event's **due time** is `startedAt + (event.startTime + passBeats − startTime) × msPerBeat`. The
clock is set once per run; only `passBeats` changes, at a loop wrap. Because it lives in the view
state, every path that resets practice — Restart, a piece change, a hands change, `attach()`,
`disconnect()` — stops it with no new code.

The **mode** and the **metronome setting** are `useState` in `App` (`'wait' | 'timed'`, default
`'wait'`; a boolean, default `true`), not view state, so none of those resets has to be told. The
reducers get the timing: `advancePracticeView(state, score, event, clock, timing)`, where `timing`
is `{ msPerBeat, grid }` in timed mode — `grid` the metronome's, or `null` with it off — and `null`
in wait-mode.

**Starting.** With no `timedClock`, a note is judged exactly as in wait-mode. When a note completes
the current event and `timing` is not null, the clock starts at that event, with `startedAt`
**snapped onto the grid**: of the times at which the grid puts this event's beat position —
`origin + (k + frac(event.startTime)) × msPerBeat` for whole `k` — the nearest to the note. With no
grid, `startedAt` is the note's own time. With a loop set, only an event inside the loop starts the
clock (decision 10): the bars before it, and an event past its end when a loop was set late, are
judged in wait-mode, and completing one moves on as wait-mode does, wrapping into the loop where it
would. So a clock never starts outside the loop. The first note starts the run and is not itself
timed: it counts in `notesPlayed`, not in the hit counters. From then on the timed rules below apply, in
`src/practice/timedPlay.ts`, and `advance()` is not called.

**The window** is ±¼ quarter-note beat around each event's due time, `TIMED_WINDOW = 0.25` in
`timedPlay.ts`: 227 ms at 100%, 455 ms at 50%, 152 ms at 150%. In beats so a slower speed is also
more forgiving, and a quarter so that for eighth notes and longer one event's window closes where the
next one's opens — only one event is ever open. Rejected: a fixed number of milliseconds, strict at
50% and loose at 150%.

**Judging a note** while the clock runs:

1. **Expire first.** Every event whose window has closed by the note's `clock` is missed (below), so
   a late note is judged after the miss, not credited to it.
2. **A pitch of the current event, not yet played, inside its window: a hit.** It joins
   `satisfiedNoteIds`; with `offset = (clock − due) / msPerBeat`, `attempt.hitNoteCount` rises by
   one, `attempt.hitOffsetBeats` by `offset` and `attempt.hitAbsOffsetBeats` by `|offset|`. When the
   event's last pitch is hit, the engine moves on through `nextIndexAfter()`.
3. **A pitch of the current event before its window, one already hit, or a pitch of the event just
   before or just after it** (linear, as wait-mode's "next event" rule is): **off-time** — into
   `wrongNotes`, so red while held, and counted in `notesPlayed` and `attempt.offTimeNoteCount`, not
   in `wrongNoteCount`.
4. **Anything else: wrong**, as in wait-mode.

`engine.heldNotes` is updated for every note, as `advance()` updates it, so the key lights. A
note-off clears `wrongNotes` as today.

**Missed.** A pure reducer in `timedPlay.ts`:

```ts
/** Every event whose window has closed by `now` is missed, in order. No clock: unchanged. */
export function expireDueEvents(
  state: PracticeViewState,
  score: Score,
  now: number,
): PracticeViewState;
```

An event is missed when `now` is **at or after** its due time plus the window. Each of its pitches
not yet hit adds one to `attempt.missedNoteCount`; the engine moves on through `nextIndexAfter()`
and `satisfiedNoteIds` is cleared. With a loop set, once `now − lastNoteAt` reaches the loop's
length (`loopLength × msPerBeat`), it removes `timedClock` instead of expiring further (decision 11).
When nothing changes it returns `state` itself.

`App` calls it from a `setTimeout` for the current event's close, set in an effect keyed on `view`,
reading the score through `scoreRef` (the filtered score is a new object every render when one hand
is chosen). The delay is rounded **up**, `Math.ceil(close − performance.now())`, because Vitest's
fake timers truncate fractional delays; and if the callback finds nothing expired, it sets the timer
again, since the unchanged state would not re-run the effect. React runs the effect that sets the
next timer only when an `act()` ends, so the App tests advance the fake clock in steps — a helper
advancing 100 ms per `act()`.

**The loop runs on at tempo.** When the engine moves from the loop's last event back to its first,
`passBeats` grows by the loop's length, `loopEndTime − loopStartTime` — the end of its last bar
minus the start of its first, from `measureStartTime(score, measure)` in `src/score/`, which sums
`beats × 4 / beatType` over the bars before. So the next pass falls due one loop later on the same
grid. Nothing else moves: the metronome's grid is its own and never re-anchored, and the cursor maps
the clock into the loop (below). Rejected: stopping the clock at the wrap so the loop's first note
restarts it, which never times the move back into the start.

**Changing the loop during a run stops the clock**, as Listen does: `setPracticeLoop` removes
`timedClock`, and the next right note inside the loop starts a new one on the grid. A loop can be
set while the engine is past its end (`DECISIONS.md`, "setting a loop doesn't jump playback"); that
event is then judged in wait-mode, and completing it wraps into the loop (decision 10). The attempt
carries on, as a loop change has never restarted it.

**The end.** When the last event is hit or missed, the piece is complete and the clock stops; the
metronome goes on clicking, as it does whenever Timed is chosen. `AttemptStats` gains `reachedEnd`,
set true only when the player's note completes the last event (decision 8); the attempt effect in
`App` reads it instead of `view.engine.status === 'complete'`. In wait-mode they are the same fact.

**What restarts a timed attempt.** Changing the speed, the mode or the metronome setting while Timed
is chosen restarts practice (`restartPractice`, keeping the loop), and a speed change restarts the
metronome's grid: each attempt has one speed, one mode and one metronome setting, and its record can
say which. In wait-mode a speed change affects only the next Listen, as today. Switching mode does
not stop a running demo. The cost: a child at bar 12 in wait-mode who switches to Timed, or silences
the click mid-run, loses the place. Rejected: zeroing the counters but keeping the place, so the next
right note starts a timed attempt from bar 12 — it needs a reset path `restartPractice` does not
have, and records that start mid-piece.

**Listen during a timed run** stops the clock, and the metronome is silent while the demo plays:
`handleListen` removes `timedClock` — only when there is one, returning `prev` otherwise, so
wait-mode gets no new `view` and its open record's `endedAt` does not move. Practice ignores notes
while the demo plays, and a running clock would miss every event under it. After Stop the metronome
resumes and the next right note starts a new clock.

**The clock is `performance.now()`.** `MidiEvent.time` is `performance.now()` from the computer
keyboard and Web MIDI's `timeStamp` from the piano, on the same timeline; the timers read
`performance.now()`, not `Date.now()`, which `DemoPlayer` uses. Vitest 5's fake timers fake
`performance.now()`.

## The metronome

`src/practice/metronome.ts`, a small class over Web Audio. `App` starts it with a `msPerBeat` when
Timed is chosen with the checkbox on, and stops it on Wait, on clearing the checkbox, on disconnect,
while Listen plays, and on unmount. It exposes its grid for the snap above, and takes one more piece
of information once a clock runs: `metronome.accentFrom(firstBarStartTime, beatsPerBar)` — the time
of a bar's first beat on the grid, computed by `App` from the clock and `measureStartTime`, and the
bar length from the piece's time signature. Every `beatsPerBar`-th click from there is accented;
`metronome.accentFrom(null)`, called when the clock stops, turns accents off, so before a clock runs
and after it stops no click is accented. Whole-bar loops and one time signature per
piece keep the accents periodic through a wrap.

- **The click** is a short oscillator burst, about 30 ms, higher for the accent, through a gain
  envelope — no samples.
- **Timing.** Each click is started at its exact audio-clock time, `oscillator.start(when)`, with
  `when` converted from the grid's `performance.now()` time and brought forward by
  `AudioContext.outputLatency` (0 where the browser does not report it), so the click is **heard** on
  the grid: the child plays with what they hear, and on Bluetooth speakers the output delay is about
  the width of the window. A timer schedules each click about 100 ms ahead. Stopping stops the node
  already scheduled, so Stop and Wait are silent at once.
- **The `AudioContext` is created, or resumed, in a click handler** — the "Timed" radio or the
  checkbox. Browsers let audio start only after a user gesture, and a note from the piano is not one.

Rejected: a `setTimeout` per click with no audio-clock scheduling, whose jitter is audible; clicking
eighths at slow speeds — at 50% a click every 1.8 s — which the manual check asks about first.

## The screen

**The controls**, on the **Restart row**, after the Speed select, under the same `isConnected`
condition: "Mode" with two radios, "Wait" and "Timed" (`data-testid="mode-wait"`, `"mode-timed"`),
and a "Metronome" checkbox (`data-testid="metronome-checkbox"`), checked by default and disabled
while Wait is chosen. Radios rather than a `<select>`, for the reason `HAND_OPTIONS` gives
(`App.tsx:87-88`): a focused select jumps on a typed letter, and the computer keyboard plays
letters. On that row because the element snapshots break on a vertical shift of what sits below
(`DECISIONS.md`); if one moves anyway, stop and report it rather than restyling the row. Mode and
metronome reset on a reload, as hands and speed do.

**The Speed select gets `onKeyDown={cancelTypeAhead}`**, as the piece select has: it now restarts a
timed attempt, and `5` and `7` are note keys (F♯4, A♯4) that would jump it to 50% or 75%.

**The staff cursor follows the clock** (commit 3). While a clock runs, the cursor marks the last
event whose time has come — where the music is — and moves on at each due time, as it follows the
Listen demo. The highlighted keys, the finger queue and the hand shading follow the engine: the next
event to play, at most one event ahead. With the metronome on this is a second cue; with it off, the
only on-beat one, which is why it is kept. A pure function in `timedPlay.ts`:

```ts
/** The startTime of the last event whose time has come by `now`, as the score position. */
export function clockPosition(
  score: Score,
  clock: TimedClock,
  loop: Loop | undefined,
  now: number,
): number;
```

The score position is `b = startTime + (now − startedAt) / msPerBeat`, folded into the loop once past
its end — `loopStartTime + ((b − loopStartTime) mod loopLength)` — so the cursor stays on the loop's
last note until the music reaches the bar line, then jumps to its start. Where no event's time has
come yet — before the snapped `startedAt`, or a folded position before the loop's first event (a bar
that opens with a rest) — it returns the clock's own `startTime`, or the loop's first event's.
`App` keeps `now` as state,
set by the same timer, which commit 3 sets for whichever comes first — the next due time or the
current close; the effect is then keyed on `view` and `now`.

**No miss marker and no live count.** The count is in the history.

## Attempt history

Recorded where the data first exists, the owner's standing rule. `AttemptRecord` gains one optional
field:

```ts
timed?: {
  speed: number; // the preset's fraction, 0.75
  bpm: number; // the tempo played to, 49.5
  window: number; // TIMED_WINDOW, in beats
  metronome: boolean;
  missedNoteCount: number;
  offTimeNoteCount: number;
  hitNoteCount: number;
  hitOffsetBeats: number; // signed sum: ÷ hitNoteCount is early (−) or late (+) on average
  hitAbsOffsetBeats: number; // sum of distances: ÷ hitNoteCount is how tight
};
```

`AttemptStats` itself becomes, with every field always present and zero in wait-mode:

```ts
{
  notesPlayed;
  wrongNoteCount;
  reachedEnd: boolean;
  missedNoteCount;
  offTimeNoteCount;
  hitNoteCount;
  hitOffsetBeats;
  hitAbsOffsetBeats;
} // the rest numbers
```

`timed` is absent on a wait-mode attempt — which is also what every record before this step says, so no stored
or exported history becomes wrong. `speed` keeps its meaning if a piece later has its own base tempo;
`window` keeps old counts comparable if the manual check changes it; `metronome` says whether the
child had a beat to play to. Stored as counters, not averages, for the reason `DECISIONS.md` gives
for storing counts and deriving accuracy. The attempt effect reads `mode`, `demoSpeed` and the
metronome setting through refs — the ones `handleEvent` needs anyway — so it stays keyed on `view`,
`piece.id` and `hands`: as dependencies, a wait-mode speed change would re-run it and move the open
record's `endedAt`. `isAttemptRecordArray` accepts a record with no `timed` and checks every field
when there is one.

The table gains **Mode** after Piece — "Wait", or "Timed 75%" with `speed` as a percentage — and
**Missed** after Wrong, "—" for wait-mode. Accuracy keeps its meaning.

## Traps

- **`handleEvent` is registered once, at `attach()`** (`App.tsx:142`'s `scoreRef` comment): it must
  read the timing through a ref. The radios only appear after connecting, so a closure would always
  see Wait.
- **`App.tsx:114-115` says the speed is "read only when Listen is pressed".** In Timed mode it also
  sets the metronome and the clock; correct the comment.
- **The replay source cannot drive timed play.** `ReplayMidiSource` re-emits the `time` a recording
  was made with, not on this page's `performance.now()` timeline, so every window would close at
  once. It is dev-only; say so in a comment where the clock starts.
- **A note stamped just inside its window can arrive after the timer expired it** (a Web MIDI
  `timeStamp` dispatched late). It is then judged off-time. Milliseconds; accepted.
- **jsdom has no `AudioContext`.** The App tests stub one that records each oscillator's start time
  and frequency, as `fakeMidiAccess` stubs Web MIDI.
- **The App tests connect under real timers** (`App.test.tsx:160`); a timed test switches to fake
  timers before choosing Timed.
- **The e2e snapshot** (`src/practice/practiceState.ts`, duplicated in `e2e/window.d.ts`) gains
  `missedNoteCount`; keep the duplicate in step.
- **Timed play assumes what every offered piece has today.** Add a test to
  `src/score/pieces.test.ts` that checks, on each offered piece's parsed `Score`: one time signature,
  with `beatType` 4; every event's `startTime` inside its own bar per `measureStartTime` (so no
  pickup or short bar); and consecutive `startTime`s at least ½ beat apart (so windows never
  overlap). A piece added by step 28 that fails it then fails CI instead of shipping wrong clicks;
  that step decides whether to extend timed play or leave the piece out.

## Four commits

1. **Timed play.** The mode radios, the Speed guard, `timedClock`, the window and the judging rules
   with their counters, `expireDueEvents`, `reachedEnd`, `measureStartTime`, the loop, the pieces
   test, and the speed, mode, loop-change and Listen rules. No metronome yet, so no grid: the first
   note is `startedAt`. The cursor still follows the engine.
2. **The metronome.** `metronome.ts`, the checkbox, the grid and the snap, the accents.
3. **The cursor follows the clock.** `clockPosition` and the `now` state. The separable one: with
   the metronome on it is a second cue, so it is the commit to drop if the branch has to shrink.
4. **History records it.** `AttemptRecord.timed`, its validation, the two columns.

## Out of scope

- **The other hand played through the piano on the same clock**: the natural next step. Its notes
  are due at the same times, as `DemoPlayer` plays Listen.
- **A metronome volume control**: the computer's volume does that.
- **Remembering mode and metronome across a reload**: a child opening the app is not dropped into a
  clock they did not choose.
- **Showing the timing counters**: recorded for later features.
- **A per-note miss marker, a live score, a continuously scrolling staff**: the child is watching
  the keys and listening to the click; the count is in the history, and OSMD's cursor moves note to
  note.
- **Speeds outside step 23's five**: the owner chose to share Listen's select.
- **Timed play from a replayed recording**, above.

## What this makes harder later

One thing is not reversible: the **persisted and exported history shape**, the optional `timed`
object and `reachedEnd`'s meaning, both put to the owner. The object is additive and older app
versions ignore unknown fields.

- **The learn-in-order mode** reading history: it can tell timed from wait, a beat from none, and a
  clock-finished run reads "Reached end: no"; the timing counters say whether a child rushes and
  how steady they are.
- **The other hand playing along**: holds — it plays the other hand's events at their due times on
  the same clock.
- **Pieces with sixteenths, pickups, compound metres or time-signature changes**: the pieces test
  fails when one is offered, and the window, the click and `measureStartTime` are revisited then.
- **A per-piece base tempo**: `speed` keeps its meaning and `bpm` records the absolute tempo.

## Decisions to record in `DECISIONS.md`

- **Retitle and amend "Practice is untimed; the Listen demo has speed presets; …"**: two modes,
  wait-mode the default; the owner's decisions above; the standard fixed-clock design, and that the
  silent re-syncing design of the first drafts was dropped because its rules only made up for a
  child with nothing to keep time by; the ±¼-beat window; the loop running on at tempo, untimed
  before it and pausing after a silent pass; what
  restarts a timed attempt; the falling-note queue still does not animate on the clock.
- **New: "The metronome clicks from the computer, not the piano"**: the P-145 has no click voice and
  no MIDI metronome control; Web Audio on the audio clock, latency-compensated, cancellable; the
  gesture rule; the free-running grid and the snap.
- **Amend "The demo is played by the piano; the app makes no sound of its own"**: the demo still is;
  the metronome is the app's one sound, by the owner's choice.
- **Amend "`MidiEvent.time` is source-relative, not wall-clock"**: timed play compares a note's
  `time` with `performance.now()`, which is why a replay cannot drive it.
- **Amend "An attempt's counters are stored; its accuracy is derived"**: the new counters and
  `reachedEnd`; an off-time note counts as played and not wrong.
- **Amend "`window.__practiceState` only carries what a Layer 3 test needs"**: it gains
  `missedNoteCount`.
- **Amend "The piece is a dropdown whose letter type-ahead is cancelled"**: the Speed select now
  cancels it too, and why.
- **Amend "Listening is not practising"**: Listen stops a timed clock and silences the metronome,
  and a mode, speed or metronome change in Timed restarts practice without stopping the demo.
- **Amend the hand-position entry** ("Practice is untimed, so one note's warning is enough"): under
  timed play the warning is still one note, pending the manual check.

## Gate

- **Layer 1, `src/practice/timedPlay.test.ts`**, a hand-built score at a round tempo: the first note
  starts the clock, snapped to the nearest grid time for its beat position, or at its own time with
  no grid, and not at all with `timing` null; a hit inside the window adds its signed and absolute
  offset; a pitch before the window, a repeat of a hit pitch, and the previous and next events'
  pitches are off-time; anything else wrong; `expireDueEvents` misses the unplayed pitches of each
  closed event, returns the same object when nothing closed, and does nothing without a clock; a late
  note after a closed window is one miss and one off-time; the last event hit sets `reachedEnd` and
  stops the clock, missed stops it with `reachedEnd` false; a loop wrap adds the loop length to
  `passBeats`; a loop change stops the clock; with a loop set, a note completing an event before
  the loop, or one past its end, does not start the clock, and one inside it does; a loop pass with
  no note stops the clock; `clockPosition` before, at and after a due time, before the snapped start,
  and across a loop's end. `measureStartTime.test.ts` for 3/4 and 4/4. The pieces test.
- **Layer 2, `src/App.test.tsx`, fake timers and the computer keyboard. This establishes that the
  behaviour exists.** Choose Timed (from commit 2, also clear the metronome — the checkbox only
  exists from then — and install the stubbed `AudioContext` for every timed test, since choosing
  Timed starts it), play Cicha Noc's first G4, and advance
  in steps past 1591 ms (A4 due at 1364, window 227 ms): the engine has moved past A4 without it being
  played. With Wait chosen, still waiting on A4. At 50%, 1591 ms is not enough and 3182 ms is. Listen
  during a timed run, advance 10 s, Stop: practice is where it was. Changing speed, mode or metronome
  in Timed restarts the attempt; changing the speed in Wait does not move the open record's
  `endedAt`. A `5` typed into the focused Speed select leaves it unchanged.
- **Layer 2, the metronome**, over `App` with the stubbed `AudioContext`: choosing Timed starts
  clicks at once, 909 ms apart at 100%, none accented; G4 played 300 ms after a click starts the clock
  on that click — A4 then falls due 1364 ms after the click, not after the note; from then on every
  third click is accented (3/4); on a one-bar loop, clicks and accents carry on unbroken through the
  wrap; none with the checkbox cleared, after choosing Wait, or while Listen plays.
- **Layer 2, history**: `attemptStore.test.ts` accepts a record without `timed` and rejects a
  malformed one; `AttemptHistory.test.tsx` shows both columns for each mode; over `App`, a timed run
  with one miss reads "Timed 100%" and Missed 1, a wait run "Wait" and "—", and a timed run the clock
  carried to the end reads Reached end "no".
- **Layer 3, `e2e/timed-play.spec.ts`**: choose Timed, clear the metronome, play G4, then nothing;
  poll `window.__practiceState` until `missedNoteCount` ≥ 1 and `nextEventIndex` has passed 1. For
  commit 3, at 50% with the metronome cleared (so no snap moves the start): 1 s after pressing G4
  (timed from before the press, as `e2e/listen.spec.ts` times), the staff cursor is still where it
  was — under commit 1 it moves to A4 at once, with the engine — then poll at 50 ms intervals until
  it moves, at 2727 ms, while `missedNoteCount` is still 0. OSMD is stubbed in jsdom, so only
  Playwright sees the cursor. Update `e2e/history.spec.ts` and
  `e2e/progress-transfer.spec.ts` for the two new columns.
- **Which commit carries which check:** Layer 1 and the first two Layer 2 bullets with commit 1
  (the snap cases, once the grid exists, in commit 2); the metronome bullet with
  commit 2; the cursor check with commit 3; the history bullet and the e2e history updates with
  commit 4.
- No committed screenshot, and do not re-bless the element snapshots.
- `npm run ci` proves the clock, the window, the counting and when clicks are scheduled, **for the
  computer keyboard**. It cannot hear the click, drive the piano's `timeStamp`, or say whether the
  window is fair. That is manual.

## Manual

In item 9 of `MANUAL-CHECKS.md`, after the Listen speed sentences: choose "Timed" at 75% on Cicha Noc
and confirm the metronome starts clicking from the computer at once. Play along on the piano: confirm
the first note starts the run, the bar's first beat is then accented, and the click is in time with
the cursor — if it trails, suspect audio output latency. Confirm notes played with the click are
accepted; stop, and confirm the music goes on without you; come back in with the click and confirm
you are accepted again. Clear "Metronome" and confirm the click stops. On Beyer No. 12, a one-bar
loop: confirm it runs on at tempo through the wrap, and that after a whole silent pass the misses stop until you play again. Say whether 50% — a click every 1.8 s — is too
sparse to follow, whether ±¼ beat feels fair to a child at 50% and at 100%, and whether a hand move
is outlined early enough.

## Finally

The "Planned — playing in time" paragraph in `prompts/README.md` was written with this brief. Move
the step to Shipped when it lands.
