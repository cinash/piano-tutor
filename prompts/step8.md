# Step 8 — Export and import progress JSON

Depends on step 7. One branch, `step-8-progress-export`, off `main`.

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
- A file picker that reads such a file back, validating it with step 7's
  `isAttemptRecordArray` and reporting a bad file through the existing error line rather than
  throwing.
- Import **merges** on `startedAt`: records not already present are added, existing ones left
  alone, and the merged list is sorted newest first so an imported record can't land out of
  order in a table that promises that order. Merging rather than replacing is what makes
  moving between two machines non-destructive.

## Out of scope

- Any format negotiation, versioning field, or CSV. One shape, the same one localStorage holds.
- Syncing, or importing a file automatically from anywhere.

## Gate

- Layer 2: the merge adds new records, leaves existing ones untouched, and returns them newest
  first given inputs that interleave.
- Layer 3: play an attempt, download the file through Playwright's download event, and assert
  its contents; then clear `localStorage`, **reload**, confirm the table is empty, import the
  file and assert the row is back. Without the reload the rows are still in React state and
  the assertion would pass even if import did nothing.
- This is the first automated exercise of the download mechanism, which calls
  `revokeObjectURL` synchronously after `anchor.click()`. If that races Playwright's download
  capture, fix the mechanism rather than adding a timeout — step 1's flake is the standing
  lesson about waiting out a race.

## Manual

Fold into `MANUAL-CHECKS.md` item 10: export from the host Chrome, import into the deployed
tailnet copy, and confirm the history arrives intact.
