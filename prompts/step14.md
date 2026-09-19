# Step 14 — Practise one hand at a time

Depends on steps 10 and 11. One branch, `step-14-one-hand-practice`, off `main`.

## Goal

Learn the hands separately, then together — how the piece is actually practised, and the feature
a flowkey user reaches for after the first read-through. Left, right, or both.

## Confirmed decision — filter the score, do not teach the engine about hands

The obvious implementation is an `EngineState.hands` field and a filter inside `advance()`. Do
not do that. It touches the reducer, `nextIndexAfter`, the early-note grace and `practiceView`'s
wrong-note check, each of which would have to agree about the same filter, and it has a stall
waiting in it (below).

Instead derive a **filtered `Score`** — the same score with each event's notes narrowed to the
selected hand, and events left with no notes dropped entirely — and hand that to the existing
engine. `advance`, `nextIndexAfter` and `advancePracticeView` all already take `score` as a
parameter, and none of them changes.

## Watch out — the stall this decision avoids

Filter inside the engine and an event belonging entirely to the other hand leaves
`expectedPitches` empty. Nothing then matches it, so `advance()` never advances past that event
and the queue stops. `advancePracticeView`, which is what actually classifies wrongness, marks
the player's notes wrong against a score whose expectations cannot be met.

It does not stall everywhere, which is what makes it nasty: `completeCurrentEvent` runs its own
`expectedPitches.every(...)`, which is `true` on an empty array, so completing a real event
recurses straight past any empty ones that follow. Mid-piece the other hand's events are
skipped and the thing looks like it works. Only index 0 — the first event of an attempt, at
start or after Restart — stalls. Dropping empty events from the score means the state cannot
occur anywhere.

## In scope

- `filterScoreByHand(score, hands)` in `src/score/filterScoreByHand.ts`: returns the score
  unchanged for `'both'`; otherwise narrows `notes` per event and drops events left empty.
  `measureCount` is untouched — the piece is still twelve bars long when you practise one hand.
- A three-way control (`left` / `right` / `both`, defaulting to `both`) in `App.tsx`. Derive the
  filtered score with a plain `const`, not a `useMemo`: nothing depends on the score's identity
  across renders, and filtering 41 events costs nothing worth protecting.
- **Check how the filtered score reaches `handleEvent`.** It currently reads the module-level
  `cichaNocScore` import directly rather than taking it as an argument, and it is registered
  once, at `attach()` time. Threading props to `FallingNotes` and `notesAt` will not
  change what that handler advances against; this is the wiring most likely to be missed.
- **Changing the hand restarts the attempt.** `nextEventIndex` is an index into the event list,
  and the filtered list is a different list — the same number means a different note. Reuse
  `restartPractice`, which already zeroes the counters, which already closes the open attempt
  record through step 7's write-through effect. Do not invent a second reset path.

## Out of scope

- **Recording the hand on `AttemptRecord`.** Nobody asked for it, and it is a `localStorage`
  schema change riding into a step about how practice works. It also carries this arc's only
  data-destroying failure: `isAttemptRecordArray` validates field by field, so a `hands` field
  added without tolerating its absence would reject every record already stored and every file
  step 8 has exported. Keep it out, and out of the same review as the filter.
- Per-hand history filtering, or comparing left against right over time.
- Remembering the hand selection across reloads. Nothing in the app is remembered across reloads
  except the attempt history; leave it that way until something asks otherwise.
- Any change to how the queue colours fingers. The filtered score already removes the other
  hand's circles from the queue, because they are no longer in the events it renders — the
  second thing the score-filtering decision buys.

## Decisions to record in `DECISIONS.md`

- Filter the score, not the engine — with the index-0 stall as the reason, since it is exactly
  the kind of thing a later refactor would undo without it written down.
- Changing hands restarts, and why the index makes that unavoidable.
- **One-hand attempts are recorded indistinguishably from two-hand ones**, so the accuracy
  column now mixes two things it does not label. That is the price of leaving the schema alone;
  record it so the next person reads it as a known trade rather than a bug.

## Gate

- Layer 2: `filterScoreByHand` over a both-hands chord, a one-hand event that survives, an event
  that disappears, and `'both'` returning the input unchanged. **This is where dropping is
  pinned** — see the Layer 3 note below for why it cannot be pinned through play alone.
- Layer 3: **assert on the queue's rendered `data-event-id`s, not on how far the queue gets.**
  Playing through proves nothing here: an implementation that narrows each event's notes but
  never drops the emptied ones behaves identically under play, because `completeCurrentEvent`
  recurses past empty events, so the queue reaches the same place either way. What differs is
  what is _rendered_ — with empties retained, the queue at the start position shows
  `m1-b4-e1` as an empty box in slot 2; with dropping, slot 2 is `m2-b1-e1`. Select the left
  hand and assert that sequence of ids. Then switch to the right hand and assert the attempt
  restarted and the expected keys changed hand colour.
- No screenshot unless the selection control lands inside the `piano-keyboard` element; if it
  sits beside it, step 13's snapshot is unaffected.

## Manual

Extend `MANUAL-CHECKS.md` item 9 with a hands clause, leaving its play-through, loop and restart
clauses exactly as they are — item 9 is one numbered item carrying several clauses, so a fourth
does not lengthen the list.

The new clause: practise the left hand alone through a short loop, confirm the right hand's
notes are neither shown nor waited for, switch to both, and confirm the attempt restarted and
the full texture came back.
