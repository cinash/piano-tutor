# Step 7 — Saving and reviewing attempts

Depends on step 6. One branch, `step-7-practice-history`, off `main`.

## Goal

Keep each attempt's summary and show the list, so the question that motivated the feature —
is this getting better — can be answered without opening devtools.

## Confirmed decision — localStorage, no backend

Asked and answered during planning: progress lives in the browser's `localStorage`, with a
JSON export/import (step 8) as the way to keep a durable copy or move it between machines. No
server, no API, no chart changes. Each browser therefore keeps its own history — the host
Chrome and the tailnet deploy are separate records, which is fine for one player on one piano.

## In scope

- `src/progress/types.ts`:

  ```ts
  interface AttemptRecord {
    startedAt: number; // Date.now() at the attempt's first note; also its identity
    endedAt: number;
    notesPlayed: number;
    wrongNoteCount: number;
    reachedEnd: boolean;
    loop?: Loop;
  }
  ```

  `startedAt` is unique per attempt and is the value rows are keyed and merged on, so there is
  no separate `id` field to mint or to disagree with it.

- `src/progress/attemptStore.ts`: `loadAttempts()` and `saveAttempts(records)` over a
  versioned key (`piano-tutor.attempts.v1`), with `isAttemptRecordArray` validating what comes
  back field by field, the way `App.tsx`'s `isMidiEventArray` validates a replay fixture.
  Anything else reads as an empty history rather than throwing — a corrupted key must not
  brick the app on load — and step 8 reuses the same predicate for imported files, so "is this
  an `AttemptRecord[]`" has one definition.
- `App` holds the history as `AttemptRecord[]` state with the open attempt first, and persists
  the whole list. One array is the source of truth, the key is its serialisation, and the
  table re-renders because the state changed — no separate table state to keep in step.
- One effect watching `view.attempt` owns the wall clock and the attempt boundary: when
  `notesPlayed` is 0 it clears the open-attempt ref (Restart, `attach()` and `disconnect()`
  all zero the counters, so this catches every reset path without touching any of their call
  sites); on the first note after that it stamps `Date.now()`, prepends a record and remembers
  its `startedAt`; on every later change it rewrites the record with that `startedAt` — by
  value, not by position, since step 8's merge can put an imported record at the head —
  setting `endedAt` to the time of the write and `reachedEnd` from `engine.status ===
'complete'`. That write-through is what removes the "end of attempt" moment: closing the
  tab, unplugging the piano and pressing Restart all leave the record already written, so no
  `beforeunload` handler is needed — the part of this that would otherwise be unreliable.
- An attempt with no notes is never written: a history of practice, not of page loads.
- `src/progress/AttemptHistory.tsx`: a plain `<table>`, newest first, one row per attempt —
  date and time, loop range (or "whole piece"), notes played, wrong notes, accuracy as a
  percentage (a dash when `notesPlayed` is 0 rather than `NaN%`), and whether it reached the
  end. Plus an empty state for the first ever visit.

## Watch out for `react-hooks/set-state-in-effect`

`eslint-plugin-react-hooks@7.1.1`'s recommended config makes that rule an **error**, and this
step's effect calls `setRecords`. Written as explicit branches that each return, it lints
clean; collapsed into a single trailing `setRecords((prev) => [record, ...prev])` it does not,
and `npm run ci` fails at its second step. Either shape is a faithful reading of the bullet
above, so know this before writing it rather than after.

## Out of scope

- Charts, trend lines, sparklines. Asked and answered during planning: a plain list. If a
  chart earns its place later it is its own step with its own screenshot.
- Deleting, editing, filtering or sorting rows. Newest first is the only order this needs.
- Any retention cap: a handful of scalars per row against a ~5 MB quota is tens of thousands
  of attempts away from a problem, and capping would discard the baseline being compared to.
- Migration between key versions. There is no v0 to migrate from; if the shape changes later,
  bump the key and let the old one lapse.

## Decisions to record in `DECISIONS.md`

- If the loop range is changed mid-attempt, the record keeps whichever range was in effect at
  the last write. The alternative — treating a loop change as a restart — loses data silently.
- `reachedEnd` is false for every looped attempt by construction, since `nextIndexAfter` wraps
  rather than completing (see the existing loop-selection entry). The column means something
  only for whole-piece attempts; that is the existing loop behaviour surfacing, not a bug to
  fix here.

## Gate

- Layer 2: the store round-trips records, and malformed JSON, an absent key and a
  well-formed-but-wrong shape all read as an empty list. Component test over a fixed set of
  records — ordering, the percentage, the dash for a zero-note record, the loop column for
  both a set and an unset loop, and the empty state.
- Layer 3: play a short attempt, restart, play another, and assert both rows appear with the
  newer first; reload the page and assert they are still there. Connect a source and reload
  without playing anything, and assert the table is still empty — the one cheap check that the
  "no notes, no record" rule is real rather than assumed.
- No committed screenshot. The existing ones exist for the falling-note view, where layout is
  the thing under test; a text table's correctness is fully expressible as the assertions
  above, and a snapshot of a column holding a real wall-clock time would pass once and fail
  every run after it.
- `reachedEnd` is deliberately left to Layer 2 on whatever builds the record: reaching it in
  Layer 3 means playing Cicha Noc to the end through the virtual keyboard, which is a long
  test for one boolean.

## Manual

Add as `MANUAL-CHECKS.md` item 10, and change that file's opening "under ten items" to "about
ten" in the same commit — a bump someone decided on, rather than a limit that quietly drifted.
The check: after a real session, close the tab, reopen it, and confirm the attempt is listed
and reads as a fair account of what was played.
