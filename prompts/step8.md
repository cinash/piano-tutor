# Step 8 — Export and import progress JSON

Status: **not started**. Depends on step 7. One branch, `step-8-progress-export`, off `main`.

## Goal

Get the history out of one browser and into another, and keep a copy that survives cleared
site data. This is the half of the storage answer that localStorage alone doesn't give.

## In scope

- Extract `downloadJson(data, filename)` from `src/midi/recording.ts`'s `downloadRecording` —
  eight lines of blob, anchor and `revokeObjectURL` — and call it from both that function and
  the new export, rather than pasting the mechanism twice. One existing caller, so it is a
  two-line change to make.
- A download control producing `progress-<timestamp>.json`: a bare `AttemptRecord[]`, no
  wrapper object, matching the convention `DECISIONS.md` already records for fixtures.
- `isAttemptRecordArray` in `src/progress/`, validating a parsed file field by field the way
  `App.tsx`'s `isMidiEventArray` validates a replay fixture. `loadAttempts` uses the same
  predicate, so "is this an `AttemptRecord[]`" has one definition and step 7's leniency about
  malformed stored data shrinks to a `JSON.parse` guard.
- A file picker that reads such a file back, reporting a bad file through the existing error
  line rather than throwing.
- Import **merges** on `startedAt`: records not already present are added, existing ones left
  alone. Merging rather than replacing is what makes moving between two machines
  non-destructive.

## Out of scope

- Any format negotiation, versioning field, or CSV. One shape, the same one localStorage holds.
- Syncing, or importing a file automatically from anywhere.

## Gate

- Layer 2: the validator accepts a well-formed export and rejects a truncated record, a wrong
  field type, and a non-array; the merge adds new records and leaves existing ones untouched.
- Layer 3: play an attempt, download the file through Playwright's download event, and assert
  its contents; then clear `localStorage`, **reload**, confirm the table is empty, import the
  file and assert the row is back. Without the reload the rows are still in React state and
  the assertion would pass even if import did nothing.

## Manual

Fold into `MANUAL-CHECKS.md` item 10: export from the host Chrome, import into the deployed
tailnet copy, and confirm the history arrives intact.
