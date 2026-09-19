# Step 14 — Practise one hand at a time

Depends on steps 10 and 11. One branch, `step-14-one-hand-practice`, off `main`.

## Goal

Learn the hands separately, then together — how the piece is actually practised, and the
feature a flowkey user reaches for after the first read-through. Left, right, or both.

## Confirmed decision — filter the score, do not teach the engine about hands

The obvious implementation is an `EngineState.hands` field and a filter inside `advance()`.
Do not do that. It touches the reducer, `nextIndexAfter`, the early-note grace and
`practiceView`'s wrong-note check, each of which would need to agree about the same filter,
and it has a deadlock waiting in it (below).

Instead derive a **filtered `Score`** — the same score with each event's notes narrowed to the
selected hand and events left with no notes dropped entirely — and hand that to the existing
engine. `advance`, `nextIndexAfter`, `setLoop` and `advancePracticeView` all already take
`score` as a parameter and none of them changes. The feature becomes a selector plus a
`useMemo`, and the engine stays a pure function of the score it was given.

## Watch out — the deadlock this decision avoids

If the filter is applied _inside_ the engine rather than to the score, an event whose notes all
belong to the other hand yields `expectedPitches === []`. Then:

- `expectedPitches.includes(event.note)` is false for every possible note, so every note the
  player plays is classified as wrong, and
- `expectedPitches.every(...)` on an empty array is `true`, so a unit test that hands the
  reducer such an event directly sees it "complete" and passes.

A green Layer 2 suite, and an app that locks up on the first left-hand-only chord. Dropping the
empty events from the score instead means the state cannot occur at all, which is the
difference between guarding a bug and not having one. If a reviewer proposes moving the filter
into the engine, this paragraph is the answer.

## In scope

- `filterScoreByHand(score, hands)` in `src/score/filterScoreByHand.ts`: returns the score
  unchanged for `'both'`; otherwise narrows `notes` per event and drops events left empty.
  `measureCount` is untouched — the piece is still twelve bars long when you practise one hand.
- A three-way control (`left` / `right` / `both`, defaulting to `both`) in `App.tsx`, with the
  filtered score memoised on it and threaded to `FallingNotes`, `expectedNotes` and every
  `advancePracticeView` call, so exactly one score object is in play per render.
- **Changing the hand restarts the attempt.** `nextEventIndex` is an index into the event list,
  and the filtered list is a different list — the same number means a different note. Reuse
  `restartPractice`, which already zeroes the counters, which already closes the open attempt
  record through step 7's write-through effect. Do not invent a second reset path.
- `AttemptRecord` gains an optional `hands?: 'left' | 'right'`, absent meaning both, and
  `AttemptHistory` gains a column. Accuracy for a one-hand attempt is not comparable with a
  two-hand one, and an uncolumned history quietly claims it is.

## Watch out — the stored history predates this field

`isAttemptRecordArray` validates field by field, and every record already in a player's
`localStorage`, and in every progress file exported by step 8, has no `hands` key. The
predicate must accept its absence, or this step silently empties the history of everyone who
has used the app. That is the one failure in this step that destroys data rather than
annoying someone, so test it directly: a fixture of step 7-era records must still load.

## Out of scope

- Per-hand history filtering, or comparing left against right over time.
- Remembering the hand selection across reloads (see step 13's note on preferences).
- Any change to how the queue colours fingers. The filtered score already removes the other
  hand's circles from the queue, because they are no longer in the events it renders — which is
  the second thing the score-filtering decision buys.

## Decisions to record in `DECISIONS.md`

- Filter the score, not the engine — with the empty-event deadlock as the reason, since it is
  exactly the kind of thing a later refactor would undo without it written down.
- Changing hands restarts, and why the index makes that unavoidable.
- `hands` is optional on `AttemptRecord` for backwards compatibility, and absent means both.

## Gate

- Layer 2: `filterScoreByHand` over a both-hands chord, a one-hand event that survives, an
  event that disappears, and `'both'` returning the input unchanged. The store predicate
  accepting a record with no `hands` key. The history component rendering both an old record
  and a new one.
- Layer 3: select the right hand, play only the right-hand pitches of measures 1–2, and assert
  the queue advances to the end of the range — the check that the dropped events really are
  dropped rather than silently waited on. Then switch to the left hand and assert the attempt
  restarted and the expected keys changed hand colour.
- Update the `piano-keyboard` screenshot only if the selection control lands inside that
  element; if it sits beside it, no snapshot changes.

## Manual

Replace `MANUAL-CHECKS.md` item 9's loop clause with a hands clause, keeping the list at about
ten: practise the right hand alone through a short loop, confirm the left hand's notes are
neither shown nor waited for, switch to both, and confirm the attempt restarted and the full
texture came back.
