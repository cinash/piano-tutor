# Step 8 — Export and import progress JSON

Status: **not started**. Depends on step 7. One branch, `step-8-progress-export`, off `main`.

## Goal

Get the history out of one browser and into another, and keep a copy that survives cleared
site data. This is the half of the storage answer that localStorage alone doesn't give.

## In scope

- A download control producing `progress-<timestamp>.json` — an `AttemptRecord[]`, following
  `src/midi/recording.ts`'s `downloadRecording` for both the mechanism and the shape
  convention (a bare array, no wrapper object, per `DECISIONS.md`).
- A file picker that reads such a file back, validating it the way `App.tsx`'s
  `isMidiEventArray` validates a replay fixture, and reporting a bad file through the existing
  error line rather than throwing.
- Import **merges** by `id`: records not already present are added, existing ones left alone.
  Merging rather than replacing is what makes moving between two machines non-destructive.

## Out of scope

- Any format negotiation, versioning field, or CSV. One shape, the same one localStorage holds.
- Syncing, or importing a file automatically from anywhere.

## Gate

- Layer 2: the validator accepts a well-formed export and rejects a truncated record, a wrong
  field type, and a non-array; the merge adds new ids and leaves existing ones untouched.
- Layer 3: play an attempt, download the file through Playwright's download event, assert its
  contents; then clear `localStorage`, import the file, and assert the rows are back in step
  7's history table.

## Manual

Fold into `MANUAL-CHECKS.md` item 9: export from the host Chrome, import into the deployed
tailnet copy, and confirm the history arrives intact.
