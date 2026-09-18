# Step 7 — Saving and reviewing attempts

Status: **not started**. Depends on step 6. One branch, `step-7-practice-history`, off `main`.

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
    id: string;
    startedAt: number; // narrowed from AttemptStats' number | null: see below
    endedAt: number;
    notesPlayed: number;
    wrongNoteCount: number;
    reachedEnd: boolean;
    loop?: Loop;
  }
  ```

- `src/progress/attemptStore.ts`: `loadAttempts()` and `saveAttempts(records)` over a
  versioned key (`piano-tutor.attempts.v1`). Unreadable or malformed stored data reads as an
  empty history rather than throwing — a corrupted key must not brick the app on load.
- `App` holds the history as `AttemptRecord[]` state with the open attempt first, and persists
  the whole list. One array is the source of truth, the key is its serialisation, and the
  table re-renders because the state changed — no upsert-by-id, no read-modify-write per note,
  and no second copy to keep in step.
- The open attempt is re-written whenever it changes, so there is no "end of attempt" moment
  to catch: closing the tab, unplugging the piano and pressing Restart all leave the record
  already written, and none of them needs a `beforeunload` handler — the part of this that
  would otherwise be unreliable. `endedAt` is simply the time of the last write.
- A new record is minted on the first `noteOn` after the view state was reset — by Restart,
  by connecting or disconnecting a device, or by a reload. An attempt with no notes is never
  written, which is why the record's `startedAt` narrows to `number`: it is the difference
  between a history of practice and a history of page loads.
- `src/progress/AttemptHistory.tsx`: a plain `<table>`, newest first, one row per attempt —
  date and time, loop range (or "whole piece"), notes played, wrong notes, accuracy as a
  percentage, and whether it reached the end. Plus an empty state for the first ever visit.

## Out of scope

- Charts, trend lines, sparklines. Asked and answered during planning: a plain list. If a
  chart earns its place later it is its own step with its own screenshot.
- Deleting, editing, filtering or sorting rows. Newest first is the only order this needs.
- Any retention cap. A record is a handful of scalars against a ~5 MB quota, so "the key grows
  without bound" is tens of thousands of attempts away; capping it would silently discard the
  oldest history, which is exactly the baseline the feature exists to compare against.
- Migration between key versions. There is no v0 to migrate from; if the shape changes later,
  bump the key and let the old one lapse.

## Decision to record in `DECISIONS.md`

If the loop range is changed mid-attempt, the record keeps whichever range was in effect at
the last write. The alternative — treating a loop change as a restart — loses data silently.

## Gate

- Layer 2: the store round-trips records; malformed JSON and an absent key both read as an
  empty list. Component test over a fixed set of records — ordering, the percentage, the loop
  column for both a set and an unset loop, and the empty state.
- Layer 3: play a short attempt, restart, play another, and assert both rows appear with the
  newer first; reload the page and assert they are still there. Add a committed screenshot of
  the history table to the existing set.

## Manual

Fold into `MANUAL-CHECKS.md` item 9: after a real session, close the tab, reopen it, and
confirm the attempt is still listed and reads as a sensible record of what was played.
