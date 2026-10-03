# Step 33 — Guarding the history write

The history is saved in `localStorage` through an unguarded `setItem` (`src/progress/attemptStore.ts`, line 70), called from an effect in `App`
(`src/App.tsx`, around line 422). When the browser's storage is full, that call throws. There is no error boundary in `src/`, so React unmounts the app
in the middle of an attempt. The child loses the screen, and the attempt is not recorded.

Step 30 makes this more likely. Uploaded pieces take up to 2 MB of the same per-origin storage (`prompts/step30.md`, Storage). The history grows on
its own, with no limit: roughly 150 to 350 bytes per attempt, which reaches megabytes within a year or two at a few dozen attempts a day (an estimate).

This brief is deferred. The owner's standing preference is that deferred work is written up, not left in a report, and this crash is the reason to write it up now.

## Why it is not in step 30

Step 30 is the upload feature. Guarding the history write changes how the app saves all practice, not only uploads, and it should be reviewed by itself.

## What it would need to answer first

1. **What the child sees when the write fails.** A message on the alert line, as the upload refusal does, and the attempt kept in memory for the session.
   Whether the history is then retried on the next attempt, or only shown as unsaved.
2. **Whether the write is retried.** Retrying every attempt would keep the message on screen; retrying on the next successful write would not.
3. **Whether the history is kept at all when the browser refuses it.** The alternative is to trim the oldest attempts. That is a loss the owner must accept, so it
   should be a question, not a default.
4. **Where the guard sits.** In `saveAttempts` (`src/progress/attemptStore.ts`) with the error returned to `App`, or in the effect in `App`. The first keeps the
   store self-contained.

## Gate, when started

- Data: a test that a quota error on the write is caught, reported, and does not throw out of `saveAttempts`.
- Component: a quota error shows the message on the alert line and the app stays mounted.
- E2E: a full store (filled with a fixture) keeps the child on the practice screen, with the message shown.
- Manual: the owner fills the browser's storage and confirms the app stays up and shows the message.
