# Step 14 — Practise one hand at a time

Depends on steps 10 and 11. One branch, `step-14-one-hand-practice`, off `main`.

## Goal

Learn the hands separately, then together — how the piece is actually practised, and the
feature a flowkey user reaches for after the first read-through. Left, right, or both.

## Confirmed decision — filter the score, do not teach the engine about hands

The obvious implementation is an `EngineState.hands` field and a filter inside `advance()`.
Do not do that. It touches the reducer, `nextIndexAfter`, the early-note grace and
`practiceView`'s wrong-note check, each of which would need to agree about the same filter,
and it has a stall waiting in it (below).

Instead derive a **filtered `Score`** — the same score with each event's notes narrowed to the
selected hand and events left with no notes dropped entirely — and hand that to the existing
engine. `advance`, `nextIndexAfter`, `setLoop` and `advancePracticeView` all already take
`score` as a parameter and none of them changes. The feature becomes a selector plus a
`useMemo`, and the engine stays a pure function of the score it was given.

## Watch out — the stall this decision avoids

Filtering inside the engine leaves `expectedPitches` empty for an event belonging entirely to
the other hand. `advance()`'s `if (!expectedPitches.includes(event.note))` is then true for
every note, so each one takes the early return and is classified as wrong, and the queue never
moves.

It does not stall everywhere, which is what makes it nasty: `completeCurrentEvent` runs its own
`expectedPitches.every(...)`, which is `true` on an empty array, so it recurses straight past
empty events mid-piece and the thing looks like it works. Only index 0 — the first event of an
attempt, at start or after Restart — stalls. Dropping empty events from the score means the
state cannot occur anywhere.

## In scope

- `filterScoreByHand(score, hands)` in `src/score/filterScoreByHand.ts`: returns the score
  unchanged for `'both'`; otherwise narrows `notes` per event and drops events left empty.
  `measureCount` is untouched — the piece is still twelve bars long when you practise one hand.
- A three-way control (`left` / `right` / `both`, defaulting to `both`) in `App.tsx`. Derive the
  filtered score with a plain `const` and thread it to `FallingNotes`, `expectedNotes` and every
  `advancePracticeView` call. Not `useMemo`: nothing in `src/` is memoised or depends on the
  score's identity across renders, and filtering 41 events costs nothing worth protecting.
  Note that `handleEvent` closes over the score and is registered once at `attach()` time —
  check how the filtered one reaches it rather than assuming the prop threading covers it.
- **Changing the hand restarts the attempt.** `nextEventIndex` is an index into the event list,
  and the filtered list is a different list — the same number means a different note. Reuse
  `restartPractice`, which already zeroes the counters, which already closes the open attempt
  record through step 7's write-through effect. Do not invent a second reset path.

## Out of scope

- **Recording the hand on `AttemptRecord`.** Nobody asked for it, and it is a `localStorage`
  schema change riding into a step about how practice works. It also carries this arc's only
  data-destroying failure: `isAttemptRecordArray` validates field by field, so a `hands` field
  added without tolerating its absence would reject every record already stored and every file
  step 8 has exported. Keep the schema change out, and keep it out of the same review as the
  filter. The cost of leaving it out is recorded below rather than ignored.
- Per-hand history filtering, or comparing left against right over time.
- Remembering the hand selection across reloads (see step 13's note on the toggle it refuses).
- Any change to how the queue colours fingers. The filtered score already removes the other
  hand's circles from the queue, because they are no longer in the events it renders — which is
  the second thing the score-filtering decision buys.

## Decisions to record in `DECISIONS.md`

- Filter the score, not the engine — with the index-0 stall as the reason, since it is exactly
  the kind of thing a later refactor would undo without it written down.
- Changing hands restarts, and why the index makes that unavoidable.
- **One-hand attempts are recorded in the history indistinguishably from two-hand ones**, so
  the accuracy column now mixes two things it does not label. That is the price of leaving the
  schema alone; record it so the next person reads it as a known trade rather than a bug.

## Gate

- Layer 2: `filterScoreByHand` over a both-hands chord, a one-hand event that survives, an
  event that disappears, and `'both'` returning the input unchanged.
- Layer 3: **select the left hand**, not the right. Every event in measures 1–2 contains a
  right-hand note, so a right-hand filter drops nothing there and the test would pass against
  an implementation that narrows notes but never drops an empty event — the exact bug this step
  exists to avoid. The left-hand filter drops four of the six events in that range —
  `m1-b4-e1`, `m1-b5-e1`, `m2-b4-e1`, `m2-b5-e1`, measure 2 being a repeat of measure 1 — so
  playing just the left-hand pitches of measures 1–2 and asserting the queue reaches the end of
  the range proves the dropping is real. Then switch to the right hand and assert the attempt
  restarted and the expected keys changed hand colour.
- Update the `piano-keyboard` screenshot only if the selection control lands inside that
  element; if it sits beside it, no snapshot changes.

## Manual

Extend `MANUAL-CHECKS.md` item 9 with a hands clause, leaving its play-through, loop and
restart clauses exactly as they are. Item 9 is one numbered item carrying several clauses, so a
fourth adds nothing to the list's length — there is no ten-item ceiling to buy your way under
here, and the loop clause is the only hardware check of wrap-around with no timeout at the wrap
point, which is the class of thing the container cannot demonstrate at all.

The new clause: practise the left hand alone through a short loop, confirm the right hand's
notes are neither shown nor waited for, switch to both, and confirm the attempt restarted and
the full texture came back. Left rather than right for the same reason the Layer 3 test uses
it — it is the hand for which events actually disappear.
