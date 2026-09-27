# Step 29 — Timed play

Adds a second way to practise beside today's wait-mode. In **timed** play the piece runs on a
fixed clock at the chosen speed, a metronome clicks the beat from the computer's speakers, and a
note not played in time is counted as missed while the music goes on. Adds
`src/practice/timedPlay.ts`, `src/practice/timedPlay.test.ts`, `src/practice/metronome.ts` and
`e2e/timed-play.spec.ts`; touches `src/practice/practiceView.ts`, `src/practice/practiceState.ts`,
`src/score/` (a bar-start helper and its test), `src/App.tsx`, `src/App.test.tsx`,
`src/progress/types.ts`, `src/progress/attemptStore.ts`, `src/progress/attemptStore.test.ts`,
`src/progress/AttemptHistory.tsx`, `src/progress/AttemptHistory.test.tsx`, `e2e/window.d.ts`,
`e2e/history.spec.ts` and `e2e/progress-transfer.spec.ts` (both assert every cell of a history
row), `DECISIONS.md` and item 9 of `MANUAL-CHECKS.md`. `src/engine/advance.ts` does not change. No
new dependency: the click is Web Audio. One branch, `step-29-timed-play`, off `main`, in **four
commits**, each passing `npm run ci` and each through the two-reviewer code gate in `CLAUDE.md` on
its own.

## Goal

The owner's ask: "a timed play with different speeds … selectable whether this should be waiting
mode as it is now or the timed play." Wait-mode lets a child play a piece note by note, as slowly
as they like. Timed play is the next stage: the same piece at a tempo the child picks, with a beat
to play to, and the notes they did not get to in time counted.

## This reverses a closed decision

`prompts/README.md` listed "Tempo in practice" under "Deliberately not planned", and
`DECISIONS.md`'s "Practice is untimed; the Listen demo has speed presets" entry records that the
owner, asked during step 23, did not want a timed mode. **The owner has now asked for one.** This
step reverses that entry in the open. Wait-mode is kept exactly as it is and stays the default.

## The standard design, and why this brief uses it

Timed play in Synthesia, Simply Piano, rhythm games and flowkey with wait mode off works the same
way: **the music is the clock**. It runs at a fixed tempo and never adjusts to the player; each
note has a small window around its own time; a key inside the window is a hit, a window that
closes unplayed is a miss, and the player keeps time by ear, from the song or a click. A child who
stops simply comes back in with the music.

Earlier drafts of this brief kept timed play silent, and every rule they added — a clock that
re-synced on each note, a window that grew with the gap since the last good note, crediting of
overlapping early notes — existed only to make up for a child with nothing to keep time by. Four
review rounds kept finding new failure cases in that machinery. The owner, shown the standard
design, chose it with a metronome, and this brief replaces all of it.

## The owner's decisions

1. **The clock runs and misses pass.** Once started, the piece moves on at tempo whether or not the
   player plays. Rejected: a clock that stops and waits on a miss; wait-mode with each note scored
   early or late.
2. **The first note starts the clock**, as wait-mode starts: nothing moves until the player plays
   the note the engine is waiting for. The metronome starts with it. Rejected: a Start button and a
   count-in.
3. **A metronome, from the computer's speakers, on by default and possible to switch off.** With it
   off, the moving cursor and the highlighted keys are the only cue. Rejected: silence as the only
   behaviour, which forced the machinery above; a click sent to the piano as a note — the P-145
   has no drum or click voice and its own metronome cannot be driven over MIDI (its MIDI
   Reference: ten melodic voices, no percussion, no metronome message), so a click would be a piano
   note blending with the child's; the song from the speakers, which needs piano samples (a new
   dependency) and plays the child the answer. **The other hand played through the piano**, as
   Listen plays, is the natural follow-up, not part of this step.
4. **Timed play shares Listen's Speed select**, step 23's five presets, 50% to 150% of `DEMO_BPM`
   (66 quarter notes a minute). Rejected: a second select.
5. **A fixed clock** — the standard design above. Rejected: the re-syncing clock and growing window
   of the earlier drafts, which the owner's earlier answers chose while timed play was silent.
6. **A right key at the wrong time is red but not counted wrong.** It lights red and counts in
   `notesPlayed`, not in `wrongNoteCount`, so accuracy means "the right keys" in both modes and
   timing shows up as misses. Rejected: counting it wrong; ignoring it silently.
7. **History records timed attempts and shows them**, with Mode and Missed columns.
8. **"Reached end" means the player's own note finished the piece.** A run the clock carried to the
   end after the child had stopped reads "no".
9. **Record the child's own timing.** First asked as "the tempo actually played", which meant
   something under a re-syncing clock. Under a fixed clock the tempo is the preset's, and the
   child's own timing is how early or late each hit was: this brief records that (below). Open
   question 1 asks the owner to confirm the translation.

## How timed play works

**The clock.** One optional field in `PracticeViewState`:

```ts
export interface TimedClock {
  startedAt: number; // performance.now() time at which score position `startTime` fell due
  startTime: number; // quarter-note beats
  msPerBeat: number; // 60000 / (DEMO_BPM × speed)
}
timedClock?: TimedClock;
```

An event's **due time** is `startedAt + (event.startTime − startTime) × msPerBeat`. The field is
set once per run and changed only at a loop wrap (below). Because it lives in the view state, every
path that resets practice — Restart, a piece change, a hands change, `attach()`, `disconnect()` —
stops the clock with no new code.

The **mode** is `useState<'wait' | 'timed'>` in `App`, default `'wait'`, not in the view state, so
none of those resets has to be told it. The reducers get the tempo:
`advancePracticeView(state, score, event, clock, msPerBeat)`, `msPerBeat` a number in timed mode
and `null` in wait-mode.

**Starting.** With no `timedClock`, a note is judged exactly as in wait-mode. When a note completes
the current event and `msPerBeat` is not null, the clock starts:
`{ startedAt: clock, startTime: thatEvent.startTime, msPerBeat }`. From then on the timed rules
below apply, in `src/practice/timedPlay.ts`, and `advance()` is not called.

**The window** is ±¼ quarter-note beat around each event's due time, `TIMED_WINDOW = 0.25` in
`timedPlay.ts`: 227 ms at 100%, 455 ms at 50%, 152 ms at 150%. In beats so a slower speed is also
more forgiving, and a quarter so that for eighth notes and longer one event's window closes where
the next one's opens — only one event is ever open. No offered piece has sixteenths or tuplets; a
piece that does is where this is revisited. Rejected: a fixed number of milliseconds, strict at 50%
and loose at 150%.

**Judging a note** while the clock runs, in `timedPlay.ts`:

1. **Expire first.** Every event whose window has closed by the note's `clock` is missed (below), so
   a late note is judged after the miss, not credited to it.
2. **A pitch of the current event, not yet played, inside its window: a hit.** It joins
   `satisfiedNoteIds`; `attempt.hitNoteCount` goes up by one and `attempt.hitOffsetBeats` by
   `(clock − due) / msPerBeat`, negative when early. When the event's last pitch is hit, the engine
   moves on through `nextIndexAfter()`.
3. **A pitch of the current event before its window, one already hit, or a pitch of the event just
   before or just after it** (linear, as wait-mode's "next event" rule is): **off-time** — into
   `wrongNotes`, so red while held, and counted in `notesPlayed` and `attempt.offTimeNoteCount`,
   not in `wrongNoteCount`.
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
and `satisfiedNoteIds` is cleared. When nothing expires it returns `state` itself, so a call that
changes nothing does not re-render.

`App` calls it from a `setTimeout` for the current event's close, set in an effect keyed on `view`,
reading the score through `scoreRef` (the filtered score is a new object every render when one hand
is chosen). The delay is rounded **up**, `Math.ceil(close − performance.now())`: Vitest's fake
timers truncate fractional delays, and a timer that fired a fraction early would find nothing to
expire and never re-arm. React runs the effect that sets the next timer only when an `act()` ends,
so the App tests advance the fake clock in steps — a helper advancing 100 ms per `act()`.

**The loop runs on at tempo.** When the engine moves from the loop's last event back to its first,
the clock is re-anchored one loop length on:
`startedAt += (loopEndTime − timedClock.startTime) × msPerBeat`, then
`startTime = loopStartTime`, where `loopStartTime` and `loopEndTime` are the start of the loop's
first bar and the end of its last. So the next pass is due one loop later, on the same beat grid,
and the metronome carries straight on. The bar starts come from a small helper in `src/score/`,
`measureStartTime(score, measure)`, summing `beats × 4 / beatType` over the bars before it; every
offered piece has one time signature (2/4, 3/4 or 4/4) and no pickup bar. Rejected: stopping the
clock at the wrap so the loop's first note restarts it, which never times the hardest transition —
back into the start — and was chosen in earlier drafts only because silence gave no reason to keep
the beat.

**The end.** When the last event is hit or missed, the piece is complete and the clock stops, and
the metronome with it. `AttemptStats` gains `reachedEnd`, set true only when the player's note
completes the last event (decision 8); the attempt effect in `App` reads it instead of
`view.engine.status === 'complete'`. In wait-mode they are the same fact.

**What restarts a timed attempt.** Changing the speed, the mode or the metronome while Timed is
chosen restarts practice (`restartPractice`, keeping the loop): each attempt has one speed, one
mode and one metronome setting, and its record can say which. In wait-mode a speed change affects
only the next Listen, as today. Switching mode does not stop a running demo. The cost: a child
who has reached bar 12 in wait-mode and switches to Timed loses the place and sets a loop to get
back to it.

**Listen during a timed run** stops the clock, and so the metronome: `handleListen` removes
`timedClock` from the view state — only when there is one, returning `prev` otherwise, so wait-mode
gets no new `view` and its open record's `endedAt` does not move. Practice ignores notes while the
demo plays, and a running clock would miss every event under it. After Stop, the next right note
starts a new clock.

**The clock is `performance.now()`.** `MidiEvent.time` is `performance.now()` from the computer
keyboard and Web MIDI's `timeStamp` from the piano, which is on the same timeline; the timer reads
`performance.now()`, not `Date.now()`, which `DemoPlayer` uses. Vitest 5's fake timers fake
`performance.now()`.

## The metronome

`src/practice/metronome.ts`, a small class over Web Audio. `App` tells it the clock whenever
`view.timedClock` changes — `metronome.follow(timedClock | undefined)` — and it clicks every
quarter-note beat at or after the clock's `startTime`, the first beat of each bar accented, until
told `undefined`. A re-anchor at a loop wrap lands on the same beat grid, so re-following it
changes nothing audible.

- **The click** is a short oscillator burst, about 30 ms, higher for the accent, through a gain
  envelope — no samples, no dependency.
- **Timing.** Each click is started at its exact audio-clock time, `oscillator.start(when)`, with
  `when` converted from `performance.now()` time, and scheduled by a timer about 100 ms ahead, so
  timer jitter does not reach the ear. Unlike Web MIDI's `send`, a scheduled Web Audio node can be
  cancelled: `follow(undefined)` stops the node already scheduled, so Stop and Restart are silent
  at once.
- **The `AudioContext` is created, or resumed, in a click handler** — the "Timed" radio or the
  metronome checkbox. Browsers let audio start only after a user gesture, and a note from the
  piano is not one.
- **Off** means `follow` is never called with a clock; nothing else about timed play changes.

Rejected: the click as a MIDI note to the piano (decision 3); a `setTimeout` per click with no
audio-clock scheduling, whose jitter is audible in a metronome.

## The screen

**The controls**, on the **Restart row**, after the Speed select, under the same `isConnected`
condition: "Mode" with two radios, "Wait" and "Timed" (`data-testid="mode-wait"`, `"mode-timed"`),
and a "Metronome" checkbox (`data-testid="metronome-checkbox"`), checked by default and disabled
while Wait is chosen. Radios rather than a `<select>`, for the reason `HAND_OPTIONS` gives
(`App.tsx:87-88`): a focused select jumps on a typed letter, and the computer keyboard plays
letters. On that row because the element snapshots break on a vertical shift of what sits below
(`DECISIONS.md`); if one moves anyway, stop and report it rather than restyling the row. Mode and
metronome are not remembered across a reload, as hands and speed are not.

**The Speed select gets `onKeyDown={cancelTypeAhead}`**, as the piece select has: it now restarts a
timed attempt, and `5` and `7` are note keys (F♯4, A♯4) that would jump it to 50% or 75%.

**The staff cursor follows the clock** (commit 3). While a clock runs, the cursor marks the last
event whose due time has passed — where the music is — and moves on at each due time, as it
follows the Listen demo. The highlighted keys, the finger queue and the hand shading follow the
engine: the next event to play. With a fixed clock the two never drift apart — the keys are at most
one event ahead. A pure function in `timedPlay.ts`:

```ts
/** The startTime of the last event due by `now`, never before the clock's own event. */
export function clockPosition(score: Score, timedClock: TimedClock, now: number): number;
```

`App` keeps `now` as state, set by the same timer, which commit 3 sets for whichever comes first —
the next due time or the current close — and the effect is then keyed on `view` and `now`: at a due
time nothing expires, and an effect keyed on `view` alone would not re-arm. Rejected: a silent
`DemoPlayer` as the clock; it cannot be judged against.

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
  hitOffsetBeats: number; // summed signed offsets; ÷ hitNoteCount = early (−) or late (+) on average
};
```

Absent on a wait-mode attempt — which is also what every record before this step says, so no
stored or exported history becomes wrong. `speed` keeps its meaning if a piece later has its own
base tempo; `window` keeps old counts comparable if the manual check changes it; `metronome` says
whether the child had a beat to play to; the hit counters are decision 9. Stored as counters, not
an average, for the reason `DECISIONS.md` gives for storing counts and deriving accuracy. The
attempt effect reads `mode`, `demoSpeed` and the metronome setting through refs — the ones
`handleEvent` needs anyway — so it stays keyed on `view`, `piece.id` and `hands`: as dependencies,
a wait-mode speed change would re-run it and move the open record's `endedAt`. `isAttemptRecordArray`
accepts a record with no `timed` and checks every field when there is one. Rejected: a required
`mode` field, which would fail every record already stored.

The table gains **Mode** after Piece — "Wait", or "Timed 75%" with `speed` as a percentage — and
**Missed** after Wrong, "—" for wait-mode. Accuracy keeps its meaning.

## Traps

- **`handleEvent` is registered once, at `attach()`** (`App.tsx:142`'s `scoreRef` comment): it must
  read the timed tempo through a ref. The radios only appear after connecting, so a closure would
  always see Wait.
- **`App.tsx:114-115` says the speed is "read only when Listen is pressed".** In Timed mode it is
  also read when the clock starts; correct the comment.
- **The replay source cannot drive timed play.** `ReplayMidiSource` re-emits the `time` a recording
  was made with, not on this page's `performance.now()` timeline, so every window would close at
  once. It is dev-only; say so in a comment where the clock starts.
- **A note stamped just inside its window can arrive after the timer expired it** (a Web MIDI
  `timeStamp` dispatched late). It is then judged off-time. Milliseconds; accepted.
- **jsdom has no `AudioContext`.** The App tests stub one that records each oscillator's start time,
  as `fakeMidiAccess` stubs Web MIDI.
- **The App tests connect under real timers** (`App.test.tsx:160`); a timed test switches to fake
  timers before the first note.
- **The e2e snapshot** (`src/practice/practiceState.ts`, duplicated in `e2e/window.d.ts`) gains
  `missedNoteCount`; keep the duplicate in step.

## Four commits

1. **Timed play.** The mode radios, the Speed guard, `timedClock`, the window and the judging
   rules, `expireDueEvents`, `reachedEnd`, the bar-start helper and the loop re-anchor, and the
   speed, mode and Listen rules. The cursor still follows the engine.
2. **The metronome.** `metronome.ts`, the checkbox, and `follow`.
3. **The cursor follows the clock.** `clockPosition` and the `now` state.
4. **History records it.** `AttemptRecord.timed`, its validation, the two columns.

## Out of scope

- **The other hand played through the piano on the same clock**: the natural next step, which the
  fixed clock makes simple — its notes are due at the same times.
- **A count-in** before the first note.
- **A metronome volume control**, or remembering mode and metronome across a reload.
- **Showing the hit timing** or the off-time count; recorded for later features.
- **A per-note miss marker, a live score, a continuously scrolling staff.**
- **Speeds outside step 23's five.**
- **Timed play from a replayed recording**, above.

## What this makes harder later

One thing is not reversible: the **persisted and exported history shape**, the optional `timed`
object and `reachedEnd`'s meaning, both put to the owner. The object is additive and older app
versions ignore unknown fields.

- **The learn-in-order mode** reading history: it can tell timed from wait, a beat from none, and a
  clock-finished run reads "Reached end: no".
- **The other hand playing along**: holds — it plays the other hand's events at their due times on
  the same `TimedClock`, as `DemoPlayer` plays Listen.
- **A count-in**: moves the clock's start from the first note to a Start button; the fixed clock is
  unchanged.
- **Pieces with sixteenths, pickup bars or time-signature changes**: the window's "one open event"
  and the bar-start helper are where they are revisited.
- **A per-piece base tempo**: `speed` keeps its meaning and `bpm` records the absolute tempo.

## Open questions for the owner

1. **Decision 9, translated.** You asked to record "the tempo actually played". Under a fixed clock
   the tempo is the preset's; what the child adds is how early or late they are. Recommended: record
   `hitNoteCount` and `hitOffsetBeats` (average early/late) as above. The alternative is to record
   nothing further. Only commit 4 depends on it, and the rest of the step holds under either answer.

## Decisions to record in `DECISIONS.md`

- **Retitle and amend "Practice is untimed; the Listen demo has speed presets; …"**: two modes,
  wait-mode the default; the owner's decisions above; the standard fixed-clock design and why the
  silent designs were dropped; the ±¼-beat window; the loop running on at tempo; what restarts a
  timed attempt; the falling-note queue still does not animate on the clock.
- **New: "The metronome clicks from the computer, not the piano"**: the P-145 has no click voice and
  no MIDI metronome control; Web Audio, scheduled on the audio clock, cancellable; the gesture rule.
- **Amend "`MidiEvent.time` is source-relative, not wall-clock"**: timed play compares a note's
  `time` with `performance.now()`, which is why a replay cannot drive it.
- **Amend "An attempt's counters are stored; its accuracy is derived"**: the new counters and
  `reachedEnd`; an off-time note counts as played and not wrong.
- **Amend "Listening is not practising"**: Listen stops a timed clock, and a mode, speed or
  metronome change in Timed restarts practice without stopping the demo.
- **Amend the hand-position entry** ("Practice is untimed, so one note's warning is enough"): under
  timed play the warning is still one note, pending the manual check.

## Gate

- **Layer 1, `src/practice/timedPlay.test.ts`**, a hand-built score at a round tempo: the first note
  starts the clock, and not with `msPerBeat` null; a hit inside the window, with its offset; a pitch
  before the window, a repeat of a hit pitch, and the previous and next events' pitches are
  off-time; anything else wrong; `expireDueEvents` misses the unplayed pitches of each closed event,
  returns the same object when nothing closed, and does nothing without a clock; a late note after
  a closed window is one miss and one off-time; the last event hit sets `reachedEnd` and stops the
  clock, missed stops it with `reachedEnd` false; a loop wrap re-anchors one loop length on;
  `clockPosition` before, at and after a due time. The bar-start helper for 3/4 and 4/4.
- **Layer 2, `src/App.test.tsx`, fake timers and the computer keyboard. This establishes that the
  behaviour exists.** Choose Timed, play Cicha Noc's first G4, advance in steps past 1591 ms (A4 due
  at 1364, window 227 ms): the engine has moved past A4 without it being played. With Wait chosen,
  still waiting on A4. At 50%, 1591 ms is not enough and 3182 ms is. Listen during a timed run,
  advance 10 s, Stop: practice is where it was. Changing speed, mode or metronome in Timed restarts
  the attempt; changing the speed in Wait does not move the open record's `endedAt`.
- **Layer 2, the metronome**, over `App` with the stubbed `AudioContext`: after the first note,
  clicks start at 0, 909, 1818 ms… at 100%, the first of each bar accented; none with the checkbox
  cleared; none after Restart.
- **Layer 2, history**: `attemptStore.test.ts` accepts a record without `timed` and rejects a
  malformed one; `AttemptHistory.test.tsx` shows both columns for each mode; over `App`, a timed run
  with one miss reads "Timed 100%" and Missed 1, a wait run "Wait" and "—".
- **Layer 3, `e2e/timed-play.spec.ts`**: choose Timed, play G4, then nothing; poll
  `window.__practiceState` until `missedNoteCount` ≥ 1 and `nextEventIndex` has passed 1. For commit
  3, at 50%: 1 s after pressing G4 (timed from before the press, as `e2e/listen.spec.ts` times),
  the staff cursor is still where it was — under commit 1 it moves to A4 at once, with the engine —
  then poll at 50 ms intervals until it moves, at 2727 ms, while `missedNoteCount` is still 0. OSMD is
  stubbed in jsdom, so only Playwright sees the cursor. Update `e2e/history.spec.ts` and
  `e2e/progress-transfer.spec.ts` for the two new columns.
- No committed screenshot, and do not re-bless the element snapshots.
- `npm run ci` proves the clock, the window, the counting and when clicks are scheduled, **for the
  computer keyboard**. It cannot hear the click, drive the piano's `timeStamp`, or say whether the
  window is fair. That is manual.

## Manual

In item 9 of `MANUAL-CHECKS.md`, after the Listen speed sentences: choose "Timed" at 75% on Cicha
Noc and play the first bars on the piano. Confirm the metronome clicks from the computer from the
first note, the bar's first beat accented, and in time with the cursor — if the click trails the
cursor, suspect audio output latency. Confirm notes played with the click are accepted; stop, and
confirm the music goes on without you; come back in with the click and confirm you are accepted
again. Clear "Metronome" and confirm the click stops. On Beyer No. 12, a one-bar loop: confirm it
runs on at tempo through the wrap. Say whether ±¼ beat feels fair to a child at 50% and at 100%,
and whether a hand move is outlined early enough.

## Finally

Update the "Planned — playing in time" paragraph in `prompts/README.md` to this design, and move the
step to Shipped when it lands.
