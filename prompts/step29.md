# Step 29 — Timed play

Adds a second way to practise beside today's wait-mode. In **timed** play the piece is paced by the
chosen speed and moves on whether or not the player keeps up, and a note not played in time is
counted as missed. Touches `src/practice/practiceView.ts`, `src/practice/practiceView.test.ts`,
`src/practice/practiceState.ts`, `src/App.tsx`, `src/App.test.tsx`, `src/progress/types.ts`,
`src/progress/attemptStore.ts`, `src/progress/attemptStore.test.ts`,
`src/progress/AttemptHistory.tsx`, `src/progress/AttemptHistory.test.tsx`, `e2e/window.d.ts`, a
new `e2e/timed-play.spec.ts`, five entries in `DECISIONS.md` (below) and item 9 of
`MANUAL-CHECKS.md`. No new dependency. One branch,
`step-29-timed-play`, off `main`, in **three commits**, each passing `npm run ci` and each through
the two-reviewer code gate in `CLAUDE.md` on its own.

## Goal

The owner's ask: "a timed play with different speeds … selectable whether this should be waiting
mode as it is now or the timed play." Wait-mode lets a child play a piece note by note, as slowly
as they like, and never asks them to keep going. Timed play is the next stage: the same piece, at
a tempo the child picks, with the notes they did not get to in time counted.

## This reverses a closed decision

`prompts/README.md` listed "Tempo in practice" under "Deliberately not planned", and
`DECISIONS.md`'s "Practice is untimed; the Listen demo has speed presets" entry records that the
owner, asked during step 23, did not want a timed mode. **The owner has now asked for one.** This
step reverses that entry in the open rather than working round it. Wait-mode is kept exactly as it
is and stays the default: timed play is a second mode, not a replacement.

## The owner's decisions

Asked before the brief was written, the owner chose:

1. **The clock runs and misses pass.** Once started, the piece moves on at tempo whether or not the
   player plays; a note not played by its deadline is counted as missed and the next one is asked
   for — flowkey with its wait mode switched off. Rejected: a clock that stops and waits on a miss,
   which never finishes a bar the child cannot play; and wait-mode with each note scored early or
   late, which never asks the child to keep going.
2. **The first note starts the clock.** Nothing moves until the player plays the note the engine is
   waiting for, exactly as in wait-mode. Rejected: a Start button with a count-in, on screen or
   clicked on the piano. Listen at the same speed is how the child hears the tempo first.
3. **Nothing extra sounds.** Rejected: a metronome click through the piano, and the app playing the
   other hand along.
4. **Timed play shares Listen's Speed select**, step 23's five presets, 50% to 150% of `DEMO_BPM`
   (66 quarter notes a minute). Rejected: a second select, which would let the child practise at a
   speed they had not heard. `DEMO_SPEED_PRESETS` keeps its name; renaming touches every caller for
   no behaviour.

Asked after the first plan review, the owner chose:

5. **The clock re-syncs on every note played in time.** Each note that completes an event inside
   its window restarts the clock from that note, so a steady tempo a little slower or faster than
   the preset is not punished. Rejected: a clock fixed at the first note — with nothing to play
   along to, a child playing steadily 9% slow at 100% misses Cicha Noc's E4 in bar 2 (due at
   2727 ms, played at 3000) and, with the clock never correcting, every note after it; and a fixed
   clock with a silent beat pulse on screen, which is more to build.
6. **A right key at the wrong time is red but not counted wrong.** It lights red, as a wrong note
   does, and counts in `notesPlayed`, but not in `wrongNoteCount`. So accuracy means "the right
   keys" in both modes, and timing shows up only as misses. Rejected: counting it wrong, which made
   a late note both missed and wrong; and ignoring it silently, which tells the child nothing.
7. **History records timed attempts and shows them**: the speed, the tempo, the window and the
   missed notes, with Mode and Missed columns in the table. Rejected: recording without showing,
   and not recording.
8. **"Reached end" means the player's own note finished the piece.** A timed run the clock carried
   to the end while the child had stopped reads "no". Rejected: "yes" whenever the run got to the
   end, and "yes" only with nothing missed.

Asked after the second plan review, the owner chose:

9. **A steady tempo within about 25% of the preset is never missed.** The window grows with the
   time since the last note played in time (below). Round 2 found that a window fixed at ±¼ beat
   undid decision 5: after one long note a child 9% slow lands outside it, and a miss does not
   re-sync, so they missed 38 of Cicha Noc's 44 events. Rejected: 15% and 10%, stricter.
10. **A timed attempt also records the tempo actually played and its off-time count.** Under a
    re-syncing clock the preset is only the target, and neither number can be derived afterwards.
    Recorded, not shown. Rejected: recording only the target.

## How timed play works

**Where the clock lives.** Every piece of timed state goes in `PracticeViewState`, as one optional
field:

```ts
export interface TimedClock { startedAt: number; startTime: number; msPerBeat: number }
/** While a timed run's clock runs: the last note played in time, and the tempo. */
timedClock?: TimedClock;
```

`startedAt` is the MIDI time of the note that last started or re-synced it, `startTime` the score
position (quarter-note beats) of the event that note completed, and `msPerBeat` is
`60000 / (DEMO_BPM × speed)`. An event's **due time** is
`startedAt + (event.startTime − startTime) × msPerBeat`. Because the field lives in the view state,
every path that already resets practice — Restart, a piece change, a hands change, `attach()`,
`disconnect()` — also stops the clock with no new code. Named `timedClock` so it is not confused
with `advancePracticeView`'s `clock: number` parameter.

The **mode** is not in the view state. It is `useState<'wait' | 'timed'>` in `App`, defaulting to
`'wait'`. The reducers are told the tempo:
`advancePracticeView(state, score, event, clock, msPerBeat)`, where `msPerBeat` is a number in
timed mode and `null` in wait-mode. Rejected: a `mode` field in `PracticeViewState`, which
`createInitialPracticeViewState()` would have to be told on every one of those resets.

**Starting, and re-syncing.** With no `timedClock`, a note is judged as in wait-mode today. When a
note completes the event that was current when it arrived and `msPerBeat` is not null,
`timedClock` becomes `{ startedAt: clock, startTime: thatEvent.startTime, msPerBeat }` — whether
there was a clock before or not. So the first event is always played in wait-mode, and every
event after it falls due one note-length after the last one the player got right.

**The window.** With a clock running, the current event can be played from its due time minus the
window to its due time plus the window, where the window, in beats, is
`TIMED_WINDOW × max(1, event.startTime − timedClock.startTime)` and `TIMED_WINDOW = 0.25`, beside
the reducer: a quarter of the time since the last note played in time, and never less than a
quarter of a beat. So a player whose steady tempo is anywhere from 80% to 133% of the preset lands
every note inside it, whatever the note lengths (decision 9); an eighth after a re-sync gets the
¼-beat floor, 227 ms at 100%. Measured in beats, so slowing down is also more forgiving. Not in
`ENGINE_TIMING`, whose comment says it is what `advance()` tunes. Rejected: a fixed ±¼ beat, which
round 2 showed collapses after one long note; and a fixed ±150 ms, strict at 50% and loose at 150%.
Consecutive windows may overlap — routinely after a long note or a miss, since a miss does not
re-sync — so the rules below credit an early note to its own event when the one before it is missed.

**While the child is silent the piece moves at 80% of the speed**, not 100%: with no note to
re-sync it, event _j_ expires 1.25 × its distance from the clock's event, the far edge of its
window. The cursor (commit 2) follows due times, so it runs ahead of the keys during a silence, and
when the child comes back in on a highlighted key — accepted, the window being wide by then — the
clock re-syncs and the cursor steps back to it. Rejected: capping the window's growth, which breaks
decision 9 across the long rests of one-hand practice (Cicha Noc's hands take the melody in turn);
and re-syncing at a missed event's due time, which brings back round 2's collapse. The manual check
asks whether the step back confuses a child.

**Judging a note** in `advancePracticeView`, when there is a `timedClock` — in this order:

1. **Expire first.** Run `expireDueEvents` (below) up to the note's `clock`, so a late note that
   arrives before the timer has fired is judged after the miss, not credited to it.
2. **A pitch of the current event, inside its window:** exactly as wait-mode — `advance()` credits
   it, and a completed event moves on and re-syncs the clock.
3. **A pitch of the current event before its window opens:** **off-time**. `advance()` is not
   called with it, so the event is still waiting; `engine.heldNotes` is updated directly so the key
   lights.
4. **A pitch of the next event:** exactly as today — not wrong, and fed to `advance()`'s early-note
   grace. Checked before rule 5, because Cicha Noc opens G4-A4-G4: the second G4 played a hair
   early is the next event's, not a late repeat of the first.
5. **A pitch of any event from the clock's own event up to the one before the current** — the
   stretch since the last note played in time: **off-time**. Typically the note of an event just
   missed, or a child carrying on from where they paused. Not only the one event before, because a
   child two events behind is playing right keys late, and decision 6 says that is not wrong.
6. **Anything else:** wrong, as today.

An **off-time** note goes into `wrongNotes`, so it is red while held, counts in `notesPlayed` and in
a new `attempt.offTimeNoteCount`, and not in `wrongNoteCount`.

**Missed.** Add a pure reducer beside `advancePracticeView`:

```ts
/** Every event whose deadline has passed by `now` is missed, in order. No clock: unchanged. */
export function expireDueEvents(
  state: PracticeViewState,
  score: Score,
  now: number,
): PracticeViewState;
```

An event's deadline is its due time plus the window. Each pitch of the event not yet played adds
one to a new `attempt.missedNoteCount`, and the engine moves on through `nextIndexAfter()`, so a
loop wraps and a miss on the last event ends the piece. An event is missed when `now` is **at or
after** its deadline, so a timer that fires exactly on it always finds something to expire.
`satisfiedNoteIds` is cleared. Each pending early note (`pendingEarlyNotes` keeps the time it was
played) whose time lies inside the **new** current event's window is credited to it, and dropped
otherwise; if that completes the event, it completes as a played note does — re-syncing the clock
to the latest credited note's time — so a child who skips a note and plays the next one in its own
window loses one note, not two. A miss itself does not re-sync the clock. When nothing has expired
it returns `state` itself, so a call that changes nothing does not re-render.

`App` calls it from a `setTimeout` for the current event's deadline, set in an effect keyed on
`view`, with the delay rounded **up** — `Math.ceil(deadline − performance.now())`. Vitest's fake
timers truncate a fractional delay, and a timer that fires a fraction of a millisecond early finds
nothing due, returns the same state, and never re-arms. Not a `setInterval` poll, which re-renders
twenty times a second for nothing. React only runs the effect that sets the next timer when an
`act()` ends, so the App tests advance the fake clock in steps — a small helper that advances 100 ms
per `act()` — rather than in one `advanceTimersByTime`, which would fire only the first timer.

**Reached end.** `AttemptStats` gains `reachedEnd: boolean`, set true by `advancePracticeView` when
a note of the player's completes the piece; `expireDueEvents` never sets it. The attempt effect in
`App` reads it instead of `view.engine.status === 'complete'`. In wait-mode the two are the same
fact, since only a note can complete the piece there.

**Completing the piece stops the clock**, as a wrap does: there is no current event to time, and
after the end every note is ignored, as wait-mode ignores it. A note that completes the last event
of the piece or of a loop still adds its stretch to the tempo counters below; then the clock stops
rather than re-syncing.

**The tempo actually played.** Each re-sync that replaces an existing clock adds
`thatEvent.startTime − timedClock.startTime` to `attempt.beatsInTime` and `clock − startedAt` to
`attempt.msInTime`: the stretches from one note played in time to the next. Their ratio is the
tempo the child kept. Stored as the two counters, not a tempo, for the reason `DECISIONS.md` gives
for storing counts and deriving accuracy. Each stretch ends in a note inside its window, so the
ratio is bounded by the window: it says how the child drifted within the tolerance, not the pace of
a child playing at 60%, which misses too much to record one. Say so in `DECISIONS.md`, so no later
feature reads it as the child's pace.

**The clock is `performance.now()`.** `MidiEvent.time` is `performance.now()` from the computer
keyboard and Web MIDI's `timeStamp` from the piano, which is on the same timeline; the timeout must
read `performance.now()`, not `Date.now()`, which `DemoPlayer` uses. Vitest 5's fake timers fake
`performance.now()` along with `setTimeout`.

**The loop.** When the engine wraps back to the loop's first event — by a hit or a miss — the
clock stops, so the loop's first note starts it again. This is a choice, not a necessity: running
on through the wrap at tempo would need the length of the loop's last bar, which
`Score.timeSignatures` and `ScoreEvent.measure` can give (no offered piece has a pickup bar). It is
not taken because stopping is simpler and gives the child a breath between passes. The cost: the
loop's first note is never played in time, which matters when drilling a bar's entry; the manual
check asks. The attempt carries on across the wrap, as in wait-mode.

**The speed.** In Timed mode, changing the speed restarts practice (`restartPractice`, keeping the
loop), so every attempt is played at one speed and its record can say which. In wait-mode a speed
change affects only the next Listen, as today. Rejected: carrying a running attempt on at the new
speed, which leaves an attempt with two speeds and one number to record.

**Switching mode** restarts practice too, as a hands change does: a run half in one mode and half
in the other is not an attempt of either. Unlike a hands change it does not stop a running demo,
which plays the same notes in either mode. The cost: a child who has reached bar 12 in wait-mode
and wants that passage timed loses the place, and sets a loop to get back to it.

**Listen during a timed run** stops the clock and keeps the place: `handleListen` removes
`timedClock` from the view state. While the demo plays, practice ignores every note
(`handleEvent`'s early return), and a clock left running would miss every event under it. After
Stop, the note practice is waiting for starts the clock again.

## The screen

**The control.** "Mode" and two radios, "Wait" and "Timed", after the Speed select **on the Restart
row**, under the same `isConnected` condition, with `data-testid="mode-wait"` and `"mode-timed"`.
Radios rather than a `<select>`, for the reason `HAND_OPTIONS` gives (`App.tsx:87-88`): a focused
select jumps option on a typed letter, and the computer keyboard plays letters. On that row
because the element snapshots break on any vertical shift of what sits below the controls
(`DECISIONS.md`); if one moves anyway, stop and report it rather than restyling the row. Rejected:
a single "Timed" checkbox, smaller but silent about what the other mode is.

**The Speed select gets `onKeyDown={cancelTypeAhead}`**, as the piece select has. It now restarts a
timed attempt, and `5` and `7` are note keys (F♯4, A♯4) that would otherwise jump it to 50% or 75%.

**The staff cursor follows the clock** (commit 2). While a clock runs, the cursor marks the last
event whose due time has passed — where the music has got to — and moves on at each due time, as
it follows the Listen demo. The keyboard's highlighted keys, the finger queue and the hand-position
shading still follow the engine: they tell the hands what to play next, and in timed play the
hands must get there before the music does. This is the split step 20 made for Listen: the cursor
says where we are, the queue says what to play. Without it nothing on screen shows the tempo. Put
the position in a pure function beside `expireDueEvents`:

```ts
/** The startTime of the last event due by `now`, and never before the clock's own event. */
export function clockPosition(score: Score, timedClock: TimedClock, now: number): number;
```

`App` keeps `now` as state, set by the same timeout, which commit 2 sets for whichever comes first —
the next due time or the current deadline. The effect is then keyed on `view` and `now`, not on
`view` alone: at a due time nothing expires, `expireDueEvents` returns the same state, and an effect
keyed only on `view` would never schedule the deadline. Rejected: a cursor on the note to play, as in
wait-mode, which in timed play shows no beat. Rejected too: a silent `DemoPlayer` as the clock,
which already drives the cursor during Listen — it is a fixed clock, which decision 5 rejected.
`clockPosition` is not loop-aware: after misses have widened the windows, the event after the
loop's end can fall due before the loop's last event expires, and the cursor shows it briefly
before the wrap. Accepted, rather than passing the loop in for a moment's display.

Commit 2 is the separable part of the step: without it timed play works, but with decision 3's
silence nothing on screen shows the beat. It is kept for that reason.

**No miss marker and no live count.** The child is watching the keys; the count is in the history.

## Attempt history

Recorded where the data first exists, the owner's standing rule. `AttemptRecord` gains one optional
field:

```ts
timed?: {
  speed: number;
  bpm: number;
  window: number;
  missedNoteCount: number;
  offTimeNoteCount: number;
  beatsInTime: number;
  msInTime: number;
};
```

Present on a timed attempt, absent on a wait-mode one — which is also what every record written
before this step says, so no stored or exported history becomes wrong. `speed` is the preset's
fraction (0.75) and keeps its meaning if a piece later gets its own base tempo; `bpm` (49.5) is the
**target** tempo; `window` is `TIMED_WINDOW`, the constant the manual check is most likely to
change, so an old count says how strict it was; `beatsInTime` and `msInTime` give the tempo the
child actually kept, which can differ from `bpm` by up to the window; and `offTimeNoteCount` is the
right keys played at the wrong time, which `notesPlayed` otherwise hides. The attempt effect in
`App` builds it from `mode` and `demoSpeed` read **through refs** — the ones `handleEvent` needs
anyway — so the effect stays keyed on `view`, `piece.id` and `hands`: as dependencies, a wait-mode
speed change would re-run it and move the open record's `endedAt` to the moment of the change. In
Timed mode both restart the attempt when they change, so a ref never reads a value the attempt was
not played at. Listen in a timed run does change `view`, and moves `endedAt` to the press, which is
right: the run stopped there. `isAttemptRecordArray` accepts a record with no `timed` and checks
all seven numbers when there is one. Rejected: a required `mode` field, which would fail every record already stored and
exported.

The history table gains **Mode** after Piece — "Wait", or "Timed 75%", `speed` formatted as a
percentage — and **Missed** after Wrong: the count for a timed attempt, "—" for a wait-mode one.
Accuracy keeps its meaning.

## Traps

- **`handleEvent` is registered once, at `attach()`** (`App.tsx:142`'s `scoreRef` comment). It
  reads the score through a ref; it must read the timed tempo through one too. The radios only
  appear after connecting, so a closure would always see Wait.
- **The replay source cannot drive timed play.** `ReplayMidiSource` re-emits a recording with the
  `time` it was recorded with, not on this page's `performance.now()` timeline, so every deadline
  would pass at once. It is a dev-only tool; say so in a comment where `advancePracticeView` starts
  the clock, rather than converting timestamps.
- **`App.tsx:114-115` says the speed is "read only when Listen is pressed".** In Timed mode it is
  also read when the clock starts; correct the comment.
- **`advance()` does not change.** Its early-note grace still governs a note of the next event
  played a hair before the current one completes. The window governs the current event, and is
  checked in `advancePracticeView` before `advance()` is called.
- **The fake clock.** Round the timeout's delay up, and advance the App tests' clock in steps, both
  for the reasons under "Missed".
- **`clockPosition` must not fall back behind the clock's event.** `now` is App state and can be
  older than a re-sync that just happened; hence "never before the clock's own event".
- **The e2e snapshot** (`src/practice/practiceState.ts`, duplicated in `e2e/window.d.ts`) gains
  `missedNoteCount`. Keep the duplicate in step.
- **The App tests connect under real timers** (`App.test.tsx:160`). A timed test must switch to fake
  timers before the first note, or its real `performance.now()` stamp puts every deadline out of
  the fake clock's reach.

## Three commits

1. **Timed play.** The radios, the Speed select's type-ahead guard, `timedClock`, the window,
   off-time and missed notes, `expireDueEvents`, `reachedEnd`, and the loop, speed, mode and Listen
   rules. The cursor still follows the engine.
2. **The cursor follows the clock.** `clockPosition` and the `now` state.
3. **History records it.** `AttemptRecord.timed`, its validation, and the two columns.

## Out of scope

- **A metronome, a count-in, the other hand playing along, or a silent beat pulse.** The owner chose
  silence and a re-syncing clock. If the manual check finds the moving cursor is not enough to keep
  time by, the pulse is the next thing to offer.
- **Earlier warning of a hand move.** Step 27 outlines the next position while the note before the
  move is waiting, and `DECISIONS.md` says a clock would want it earlier. Under timed play that is
  about one note's length of warning, which the re-syncing clock makes less pressing; the manual
  check asks.
- **Remembering the mode across a reload.** It resets to Wait, as hands and speed reset: a child
  opening the app is not dropped into a clock they did not choose.
- **A per-note miss marker or a live score on screen.**
- **Speeds outside step 23's five, or a slider.** The owner chose to share Listen's select, and
  those are its five.
- **A continuously scrolling staff**, flowkey's moving sheet. OSMD's cursor moves note to note.
- **Timed play from a replayed recording**, above.
- **Showing the tempo kept or the off-time count.** Recorded for later features, by decision 10.

## What this makes harder later

The one thing not reversible is the **persisted and exported history shape**: the optional `timed`
object, and `reachedEnd` meaning "the player's note finished it". Both were put to the owner. The
object is additive; older app versions ignore it (`isAttemptRecordArray` does not reject unknown
fields); no existing record changes. Once progress files carry it, its fields keep these meanings.

Futures played forward:

- **The learn-in-order mode** the owner has said comes later, reading history to decide a piece is
  learned: it can tell a timed run from a wait one, and a clock-finished run reads "Reached end: no".
- **A metronome or count-in.** A click wants a fixed clock, and the owner chose a re-syncing one: a
  metronome would bring the fixed clock back as a second behaviour. `startedAt` and `msPerBeat` are
  still what a click schedule is built from.
- **The other hand playing along.** Needs the demo and practice to share a clock, which step 17 kept
  apart. `timedClock` gives practice one; `DemoPlayer` would have to be anchored to it. Not blocked.
- **A per-piece base tempo.** `speed` keeps its meaning and `bpm` records the absolute target.
- **The window tuned after the manual check.** Old counts stay comparable through `window`. A change
  of the clock rule itself — a fixed clock for a metronome — would need a field saying which rule
  judged the attempt; add it then, since every record until then was judged by this one.

## Decisions to record in `DECISIONS.md`

- **Retitle and amend "Practice is untimed; the Listen demo has speed presets; …"**: practice has
  two modes, wait-mode the default. Record the ten owner decisions above, the window and why it
  grows with the time since the last note in time, that the piece moves at 80% while the child is
  silent and why, why the clock stops at a loop wrap, why a speed change restarts a timed attempt,
  and that the falling-note queue still does not animate on the clock — only the staff cursor
  follows it.
- **Amend "`MidiEvent.time` is source-relative, not wall-clock"**: timed play compares a note's
  `time` with `performance.now()`, which holds for the computer keyboard and the piano, and is why a
  replayed recording cannot drive it.
- **Amend "An attempt's counters are stored; its accuracy is derived"**: `AttemptStats` now also
  carries `missedNoteCount`, `offTimeNoteCount`, `beatsInTime`, `msInTime` and `reachedEnd`; an
  off-time note counts as played and not wrong; and the tempo from `beatsInTime` and `msInTime` is
  bounded by the window, so it is not the child's pace.
- **Amend "Listening is not practising"**: Listen now touches `PracticeViewState` in one way — it
  stops a timed clock — and why; and "whatever restarts practice stops the demo too" no longer
  holds for a mode switch or a timed speed change, which restart practice and leave the demo alone.
- **Amend the hand-position entry** ("Practice is untimed, so one note's warning is enough"): under
  timed play the warning is still one note, by this step's choice, pending the manual check.

## Gate

- **Layer 1, `src/practice/practiceView.test.ts`, over a hand-built score at a round tempo.** The
  first note starts the clock at that note's time; with `msPerBeat` null it does not. A note in its
  window advances, re-syncs the clock to its own time and adds to `beatsInTime` and `msInTime`. The
  window after a long note is a quarter of it; after an eighth, a quarter beat. A current pitch
  before its window is red, counts as played and off-time and not wrong, and does not advance. A
  pitch in both the previous and the next event, played early, feeds the grace, not off-time. A
  late note arriving before any expiry call is judged after the miss: one miss, and the pitch
  off-time, not wrong. A right key two events behind is off-time, not wrong. A note of the next
  event played inside its own window while the current one is unplayed is credited to it when the
  current one expires: one miss, not two. `expireDueEvents` past one
  deadline misses the unplayed pitches of that event, past two misses both, returns the same object
  when nothing is due, and changes nothing without a clock. A miss on the last event completes the
  piece with `reachedEnd` false; a note completing it sets `reachedEnd` true; either stops the
  clock. A wrap stops the clock. `clockPosition` at, before and after a due time.
- **Layer 2, `src/App.test.tsx`, with the computer keyboard and fake timers. This establishes that
  the behaviour exists.** Choose Timed, play Cicha Noc's first G4, advance the clock in steps past
  1705 ms (A4 due at 1364, window ⅜ beat, 341 ms, at 100%): the position has moved past A4 without
  it being played. With Wait chosen, the same: still waiting on A4 — the check of wait-mode's "no
  timeout" under a clock. At 50%, 1705 ms is not enough and 3410 ms is (the deadline is
  3409.09 ms, and the timer's delay is rounded up). Listen during a timed run, advance 10 s, Stop:
  practice is where it was. Changing
  the speed in Timed mode starts the attempt again, and so does switching mode.
- **Layer 2, the history.** `attemptStore.test.ts`: a record with no `timed` is accepted, one with
  a malformed `timed` rejected. `AttemptHistory.test.tsx`: the two columns for each mode. **Over
  `App`**: after a timed run with a miss, the row reads "Timed 100%" with Missed 1; after a
  wait-mode run, "Wait" and "—". That is the check that fails if `App` never writes `timed`.
- **Layer 3, a new `e2e/timed-play.spec.ts`.** Choose "Timed", play G4 on the computer keyboard,
  then nothing: poll `window.__practiceState` until `missedNoteCount` is at least 1 and
  `nextEventIndex` has passed 1. For commit 2, in the same file, at 50%: play G4, and 1 s after the
  key press (measured from before it, as `e2e/listen.spec.ts` measures) assert that the staff
  cursor, read as `e2e/staff-cursor.spec.ts` reads it, is still where it was before G4 — under
  commit 1 it moves to A4 at once, with the engine — then poll at 50 ms intervals
  (`{ intervals: [50] }`, as `e2e/listen.spec.ts` does; the default intervals grow to 1 s and can
  step over the 682 ms margin) until it moves, which it does at A4's due time, 2727 ms, while
  `missedNoteCount` is still 0. That is the check that fails if the cursor does not follow the
  clock; OSMD is stubbed in jsdom, so no App test can see it.
- No committed screenshot, and do not re-bless the element snapshots.
- `npm run ci` green proves the clock, the window and the counting **for the computer keyboard**.
  Nothing in it drives the piano's `timeStamp` against `performance.now()`, and it cannot say
  whether a child can keep time with no sound, or whether the window is fair. That is manual.

## Manual

In item 9 of `MANUAL-CHECKS.md`, after the Listen speed sentences: choose "Timed" at 75%, play the
first bars of Cicha Noc in time on the piano, and confirm the notes are accepted and the cursor
moves with the beat — if the piano gets misses the computer keyboard does not, suspect its
timestamps. Stop playing and confirm the piece moves on without you. Say whether the window feels fair
to a child at 50% and at 100%, whether the moving cursor is enough to keep time by with no click,
whether a hand move is outlined early enough, and, on a one-bar loop, whether starting each pass
on the first note feels right or the loop should run on at tempo. Finally, stop for a bar, then
come back in on the highlighted key, and say whether the cursor stepping back to it confuses a
child.

## Finally

The Planned row in `prompts/README.md` and the replaced "Tempo in practice" paragraph were added
with this brief. Move the step to Shipped when it lands.
