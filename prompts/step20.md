# Step 20 — The cursor follows the demo

Finishes step 17, which lit the keyboard up while the demo played but left the staff cursor
sitting where practice was. Touches `practice/demo.ts` and `App.tsx` and their tests; no new
module, no new dependency, no new control on screen. One branch,
`step-20-staff-follows-demo`, off `main`.

## Goal

Press "Listen" and the piano plays, the keys light up — and the green marker on the staff
does not move. Make it follow the demo, and go back to where practice was when the demo
stops.

Reported by the player after step 19 made the demo audible: _"it's not following the green
highlight on the pięciolinia"_.

## Why it sits still

`App` gives the staff one thing, the note the engine is waiting for:

```tsx
<StaffView targetStartTime={score.events[view.engine.nextEventIndex]?.startTime} />
```

Step 17's decision that **listening is not practising** is right and stays: the demo never
touches `PracticeViewState`, so `nextEventIndex` does not move while it plays. Step 17 gave
the keyboard a second source for the same reason — `heldNotes={demoNotes ?? …}` — but never
gave the staff one, so the cursor is pinned to practice for the length of the demo.

The demo cannot supply a position today even if asked: `DemoStep` is `{ atMs, pitches }`,
and `DemoPlayer` reports only the pitches. `atMs` is a wall-clock offset for the timer, not
a place in the score, and the staff wants quarter-note beats — `StaffView.targetStartTime`
is the same unit as `ScoreEvent.startTime`.

## Confirmed decision — the cursor follows, the instruction does not

The staff cursor answers _"where are we in the music"_, so while the demo plays it shows
where the demo is. The falling-note queue and the keyboard's expected-note highlight answer
_"what should you play"_, and they stay with practice, unchanged: step 17 settled that
nothing is asked for during a demonstration, and a queue racing ahead of a child who is
listening would be a second instruction at the same time. **The queue is out of scope.**

Practice state stays untouched. The demo's position is component state beside `demoNotes`,
so Stop — or the schedule running out — restores the practice cursor exactly where it was,
by the same path that already restores the keyboard.

## In scope

- **`DemoStep` carries where it is, not only when.** Add `startTime: number`, in
  quarter-note beats from the start of the piece, beside the existing `atMs`. A step that
  sounds an event carries that event's `startTime`; the step of silence that closes an event
  carries the event's end, so that the cursor moves off a note that has stopped sounding
  rather than sitting on it through the gap.

- **`DemoPlayer` reports the step rather than the pitches.** The callback becomes
  `(step: DemoStep | null) => void`; `null` still means the schedule ran out and still ends
  the demo. The pitches are read off the step at the other end.

- **`App` holds the step and prefers it for the staff.** The `demoNotes` state becomes the
  current `DemoStep | null`; the staff is given the demo's `startTime` while one is running
  and the engine's target otherwise. `stopDemo` clears it as it does today.

## Out of scope

- **The falling-note queue and the expected-note highlight.** See the decision above.
- **Scrolling, or any change to `StaffView`.** It already takes a beat position and seeks to
  it; this step only changes what it is given. Its `scrollIntoView({ block: 'nearest' })`
  behaviour is step 16's and stays as it is.
- **A second cursor, a different colour for the demo, or any marker of its own.** One
  cursor, showing one position.
- **Tempo, the schedule, the port lookup, the highlighting, the history.** Untouched.

## Decisions to record in `DECISIONS.md`

Amend the existing "Listening is not practising" entry rather than adding a new one — it
currently reads as though the demo drives nothing outside the keyboard, which is what this
step changes.

- While the demo plays the staff cursor follows it; the queue and the expected keys do not.
  The line is between "where are we" and "what should you play".
- The demo still never touches `PracticeViewState`. Its position is component state, so Stop
  restores the practice cursor by the same path that restores the keyboard.
- `DemoStep` carries a position in beats as well as an offset in milliseconds, because the
  two are different questions: `atMs` is when the timer fires, `startTime` is where in the
  score the marker goes.

## Gate

- **Layer 1 over `buildDemoSchedule`:** every step carries the beat position that matches
  its `atMs` — an event's step carries the event's `startTime`, and a step of silence
  carries the end of the event it closes. Assert it on `cichaNoc` and on the existing gap
  fixture, where the silence at beat 1 and the next event at beat 2 are different numbers.
- **Layer 2 over `App`:** the existing listening tests must still pass — the keyboard
  follows the demo, nothing is expected while it runs, `position-readout` does not move, and
  Stop restores all of it. jsdom cannot see the cursor: `src/testSetup.ts` stubs OSMD out
  because `render()` needs a canvas, so the staff's own behaviour is not assertable there and
  must not be faked into looking as though it were.
- **Layer 3 in Chromium, which is where the cursor is real.** Extend `e2e/listen.spec.ts`:
  with the demo running the cursor moves off where it started within the opening bars, and on
  Stop it returns to that same position. Read it the way `e2e/staff-cursor.spec.ts` does —
  the inline `left`/`top` of the one `<img>` inside `[data-testid="staff"]`, which is
  independent of how far the pane has scrolled. `e2e/staff-cursor.spec.ts` itself is
  practice-only and must pass untouched.
- `npm run ci` green.
- Say plainly in the report that the suite proves the marker moves, not that it moves to the
  right note. Which note the cursor sits on over a run of bars is item 11 of
  `MANUAL-CHECKS.md`, and only the owner can read it against the printed music.

## Manual

Extend `MANUAL-CHECKS.md` item 9, which already covers Listen, rather than adding an item:
while the piano plays, the green cursor moves along the staff with it and is on the bar being
played; Stop puts it back on the note practice was waiting for.

## Finally

Add step 20 to `prompts/README.md` in its own short section after step 19's, and move step 19
into the Shipped table at the same time — it shipped with the merge that preceded this step.
Step 18 is still unbuilt and stays where it is.
